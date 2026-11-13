-- Refood Management — System 2 (volunteer kiosk) + System 3 support
-- Same rules as 0001: RLS on, no policies, server-only access with the secret key.

-- ---------------------------------------------------------------------------
-- Volunteers. Number is automatic and never reused.
-- ---------------------------------------------------------------------------
create sequence if not exists public.volunteer_number_seq start 1;

create table if not exists public.volunteers (
  id         uuid primary key default gen_random_uuid(),
  number     integer not null unique default nextval('public.volunteer_number_seq'),
  name       text not null check (length(trim(name)) > 0),
  phone      text not null default '',
  email      text not null default '',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter sequence public.volunteer_number_seq owned by public.volunteers.number;
create index if not exists volunteers_name_idx on public.volunteers (lower(name));

drop trigger if exists volunteers_touch on public.volunteers;
create trigger volunteers_touch before update on public.volunteers
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Volunteer check-ins (System 2). One per volunteer per Portugal day.
-- ---------------------------------------------------------------------------
create table if not exists public.check_ins (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid unique,
  volunteer_id  uuid not null references public.volunteers (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  day           date not null,
  schedule      smallint not null check (schedule in (1, 2)),
  kiosk_id      text not null default 's2',
  constraint check_ins_once_a_day unique (volunteer_id, day)
);
create index if not exists check_ins_at_idx on public.check_ins (checked_in_at desc);

-- ---------------------------------------------------------------------------
-- Task lists. Deleting a task only stamps deleted_at so past completions
-- stay in the analytics.
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  schedule   smallint not null check (schedule in (1, 2)),
  name       text not null check (length(trim(name)) > 0),
  details    text not null default '',
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists tasks_list_idx on public.tasks (schedule, position) where deleted_at is null;

create table if not exists public.task_photos (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  path        text not null,
  uploaded_at timestamptz not null default now()
);
create index if not exists task_photos_task_idx on public.task_photos (task_id, uploaded_at);

-- Task status per day: one row per task per Portugal day. "done = false" with a
-- completed_at means it was done and then reopened. changed_at orders offline
-- replays (the latest tap wins).
create table if not exists public.task_completions (
  task_id      uuid not null references public.tasks (id) on delete cascade,
  day          date not null,
  schedule     smallint not null check (schedule in (1, 2)),
  done         boolean not null,
  completed_at timestamptz,
  reopened     boolean not null default false,
  changed_at   timestamptz not null default now(),
  primary key (task_id, day)
);
create index if not exists task_completions_day_idx on public.task_completions (day);

-- ---------------------------------------------------------------------------
-- Emergency contacts, events (photo-panel cards) and photos.
-- ---------------------------------------------------------------------------
create table if not exists public.emergency_contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) > 0),
  phone      text not null check (length(trim(phone)) > 0),
  note       text not null default '',
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) > 0),
  body       text not null default '',
  image_path text,
  qr_link    text not null default '',
  starts_on  date not null,
  ends_on    date not null,
  created_at timestamptz not null default now(),
  constraint events_dates check (ends_on >= starts_on)
);

create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid unique,
  path        text not null,
  uploaded_at timestamptz not null default now(),
  source      text not null check (source in ('kiosk', 'admin')),
  expires_at  timestamptz,
  hidden      boolean not null default false
);
create index if not exists photos_uploaded_idx on public.photos (uploaded_at desc);

-- ---------------------------------------------------------------------------
-- Lock everything down.
-- ---------------------------------------------------------------------------
alter table public.volunteers         enable row level security;
alter table public.check_ins          enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_photos        enable row level security;
alter table public.task_completions   enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.events             enable row level security;
alter table public.photos             enable row level security;

revoke all on public.volunteers, public.check_ins, public.tasks, public.task_photos,
  public.task_completions, public.emergency_contacts, public.events, public.photos
  from anon, authenticated;
revoke all on sequence public.volunteer_number_seq from anon, authenticated;

-- Private storage bucket for every image (kiosk photos, admin photos, task
-- photos, event images). Images are served through the app after an auth check.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
