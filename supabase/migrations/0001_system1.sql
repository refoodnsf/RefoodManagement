-- Refood Management — System 1 (beneficiary kiosk) + System 3 support
-- All tables have Row Level Security ON and no policies: the public (anon)
-- key can read nothing. The app talks to the database only from the server,
-- using the secret key, after checking the kiosk token or the coordinator login.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Coordinator profiles (System 3 users). Linked 1:1 to Supabase Auth users.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  name       text not null default '',
  role       text not null check (role in ('administrador', 'gestor_beneficiarios')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Registered beneficiaries. Number is automatic and never reused.
-- ---------------------------------------------------------------------------
create sequence if not exists public.beneficiary_number_seq start 1;

create table if not exists public.beneficiaries (
  id          uuid primary key default gen_random_uuid(),
  number      integer not null unique default nextval('public.beneficiary_number_seq'),
  name        text not null check (length(trim(name)) > 0),
  type        text not null default 'familia' check (type in ('familia', 'individual')),
  adults      integer not null default 1 check (adults between 0 and 30),
  children    integer not null default 0 check (children between 0 and 30),
  food_needs  text[] not null default '{}',
  food_notes  text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint beneficiaries_has_people check (adults + children > 0)
);
alter sequence public.beneficiary_number_seq owned by public.beneficiaries.number;

create index if not exists beneficiaries_name_idx on public.beneficiaries (lower(name));

-- ---------------------------------------------------------------------------
-- Beneficiary events (visits) recorded by the System 1 kiosk.
-- client_id makes offline retries idempotent.
-- ---------------------------------------------------------------------------
create table if not exists public.beneficiary_events (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid unique,
  recorded_at    timestamptz not null default now(),
  type           text not null check (type in ('nao_inscrito', 'inscrito')),
  beneficiary_id uuid references public.beneficiaries (id) on delete set null,
  people         integer not null check (people between 1 and 60),
  kiosk_id       text not null default 's1',
  undone         boolean not null default false,
  undone_at      timestamptz,
  constraint inscrito_needs_beneficiary check (type = 'nao_inscrito' or beneficiary_id is not null or undone)
);

create index if not exists beneficiary_events_recorded_idx on public.beneficiary_events (recorded_at desc);
create index if not exists beneficiary_events_benef_idx on public.beneficiary_events (beneficiary_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Lock everything down: RLS on, no policies.
-- ---------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.beneficiaries      enable row level security;
alter table public.beneficiary_events enable row level security;

revoke all on public.profiles, public.beneficiaries, public.beneficiary_events from anon, authenticated;
revoke all on sequence public.beneficiary_number_seq from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Counts for the kiosk dashboard, in Portugal time (Monday-start weeks).
-- ---------------------------------------------------------------------------
create or replace function public.s1_counts()
returns table (today integer, week integer)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      (date_trunc('day',  now() at time zone 'Europe/Lisbon') at time zone 'Europe/Lisbon') as day_start,
      (date_trunc('week', now() at time zone 'Europe/Lisbon') at time zone 'Europe/Lisbon') as week_start
  )
  select
    coalesce(sum(e.people) filter (where e.recorded_at >= b.day_start), 0)::int  as today,
    coalesce(sum(e.people) filter (where e.recorded_at >= b.week_start), 0)::int as week
  from bounds b
  left join public.beneficiary_events e
    on e.recorded_at >= b.week_start and not e.undone
  group by b.day_start, b.week_start;
$$;

revoke all on function public.s1_counts() from public, anon, authenticated;
grant execute on function public.s1_counts() to service_role;

-- Keep updated_at fresh on beneficiaries.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists beneficiaries_touch on public.beneficiaries;
create trigger beneficiaries_touch before update on public.beneficiaries
  for each row execute function public.touch_updated_at();
