-- Profiles: one row per auth user, created by trigger on sign-up.
-- Access is deny-by-default: RLS on, table privileges granted explicitly and narrowly.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 60),
  home_city text
    constraint profiles_home_city_length check (home_city is null or char_length(home_city) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public-facing traveller profile; one per auth user.';

alter table public.profiles enable row level security;

-- Least privilege: nobody gets blanket table rights. Rows are created only by the trigger below,
-- and users may change only their editable columns (never id or timestamps).
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name, home_city) on table public.profiles to authenticated;

create policy "Profiles are readable by their owner"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Profiles are editable by their owner"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Keep updated_at honest without trusting the client.
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create the profile when an auth user is created. SECURITY DEFINER because the inserting role
-- (supabase_auth_admin) has no rights on public.profiles; search_path is pinned to avoid hijacking.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(requested_name, split_part(new.email, '@', 1), 'Traveller'), 60)
  );
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
