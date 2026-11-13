-- Next number the volunteer sequence will hand out (shown in System 3 before saving).
create or replace function public.next_volunteer_number()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (case when is_called then last_value + 1 else last_value end)::int from public.volunteer_number_seq;
$$;

revoke all on function public.next_volunteer_number() from public, anon, authenticated;
grant execute on function public.next_volunteer_number() to service_role;
