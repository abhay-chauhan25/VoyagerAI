-- Public profiles and Travel DNA.

-- Handles and opt-in public profiles. Profiles stay private until their owner turns this on.
alter table public.profiles
  add column handle text
    constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,30}$'),
  add column is_public boolean not null default false;

create unique index profiles_handle_key on public.profiles (handle);

grant update (handle, is_public) on table public.profiles to authenticated;

-- A public profile can be read by anyone, signed in or not. Email lives in auth.users, never here.
drop policy "Profiles are readable by their owner" on public.profiles;
create policy "Profiles are readable by their owner or when public"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id or is_public);
create policy "Public profiles are readable by visitors"
  on public.profiles for select
  to anon
  using (is_public);
grant select on table public.profiles to anon;

-- Helper for policies on child tables: is this user's profile public? SECURITY DEFINER so the check
-- works for visitors who cannot read the profiles table directly; it returns a boolean and nothing else.
create function public.profile_is_public(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_public from public.profiles where id = profile_id), false);
$$;
revoke all on function public.profile_is_public(uuid) from public;
grant execute on function public.profile_is_public(uuid) to anon, authenticated;

create type public.travel_pace as enum ('slow', 'balanced', 'full');
create type public.budget_band as enum ('shoestring', 'comfortable', 'splurge');
create type public.dna_reaction as enum ('pass', 'love', 'more');

create table public.travel_dna (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  pace public.travel_pace not null,
  budget public.budget_band not null,
  companions text[] not null default '{}'
    constraint travel_dna_companions_known
      check (companions <@ array['solo', 'partner', 'friends', 'family']::text[]),
  -- interest label -> weight in [-1, 1]; validated in the app before every write.
  interest_weights jsonb not null default '{}'
    constraint travel_dna_weights_object check (jsonb_typeof(interest_weights) = 'object'),
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger travel_dna_touch_updated_at
  before update on public.travel_dna
  for each row execute function public.touch_updated_at();

alter table public.travel_dna enable row level security;
revoke all on table public.travel_dna from anon, authenticated;
grant select on table public.travel_dna to anon, authenticated;
-- user_id is in the update list only because upserts re-send it; the policy below pins it to the caller.
grant insert (user_id, pace, budget, companions, interest_weights),
      update (user_id, pace, budget, companions, interest_weights)
  on table public.travel_dna to authenticated;

create policy "Travel DNA is readable by its owner or on a public profile"
  on public.travel_dna for select
  to authenticated, anon
  using ((select auth.uid()) = user_id or public.profile_is_public(user_id));
create policy "Travel DNA is created by its owner"
  on public.travel_dna for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Travel DNA is edited by its owner"
  on public.travel_dna for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Each answer in the onboarding deck, kept so Voyager can explain where a trait came from.
create table public.dna_reactions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  scene_id text not null constraint dna_reactions_scene_format check (scene_id ~ '^[a-z0-9-]{1,40}$'),
  reaction public.dna_reaction not null,
  created_at timestamptz not null default now(),
  primary key (user_id, scene_id)
);

alter table public.dna_reactions enable row level security;
revoke all on table public.dna_reactions from anon, authenticated;
-- Upserts re-send the key columns; the policy below keeps every row owned by the caller.
grant select, insert, update (user_id, scene_id, reaction), delete on table public.dna_reactions to authenticated;

create policy "Reactions belong to their owner"
  on public.dna_reactions for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
