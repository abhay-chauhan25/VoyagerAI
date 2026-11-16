-- Friends, fuller profiles, and places Compass suggests beyond a traveller's own saves.

-- ---------- Proposals can carry the places they suggest ----------
-- A proposed "add" may name a place the traveller never saved. Its details travel with the
-- proposal, so accepting it later adds exactly the place that was shown.
alter table public.proposals
  add column places jsonb not null default '[]'
    constraint proposals_places_array check (jsonb_typeof(places) = 'array' and pg_column_size(places) < 65536);
grant insert (places) on table public.proposals to authenticated;

-- ---------- Profiles: bio and a link, shown wherever the profile is ----------
alter table public.profiles
  add column bio text constraint profiles_bio_length check (char_length(bio) <= 280),
  add column website text
    constraint profiles_website_format check (website ~ '^https://[^\s<>"]{3,200}$');
grant update (bio, website) on table public.profiles to authenticated;

-- ---------- Contact details: private by default, shared per field ----------
create type public.contact_audience as enum ('hidden', 'friends', 'followers', 'travellers');

create table public.profile_contacts (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  contact_email text
    constraint profile_contacts_email_format check (contact_email ~ '^[^@\s<>]{1,64}@[^@\s<>]{1,190}\.[^@\s<>]{2,}$'),
  phone text constraint profile_contacts_phone_format check (phone ~ '^\+?[0-9][0-9 ()-]{5,22}$'),
  email_audience public.contact_audience not null default 'hidden',
  phone_audience public.contact_audience not null default 'hidden',
  updated_at timestamptz not null default now()
);
alter table public.profile_contacts enable row level security;
revoke all on table public.profile_contacts from anon, authenticated;
grant select on table public.profile_contacts to authenticated;
grant insert (contact_email, phone, email_audience, phone_audience),
      update (contact_email, phone, email_audience, phone_audience)
  on table public.profile_contacts to authenticated;

-- The table itself is the owner's alone. Everyone else goes through profile_contact() below.
create policy "Contact details belong to their owner" on public.profile_contacts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- Friends: two travellers who follow each other ----------

-- Whether someone already follows the caller. SECURITY DEFINER: a rule on the follows table can't
-- read that same table itself without going round in circles.
create function public.is_followed_by(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.follows f
    where f.follower_id = p_other and f.followee_id = (select auth.uid())
  );
$$;
revoke all on function public.is_followed_by(uuid) from public, anon;
grant execute on function public.is_followed_by(uuid) to authenticated;

-- Following back is always allowed, even if the person who followed you keeps a private profile.
drop policy "Travellers follow public profiles" on public.follows;
create policy "Travellers follow public profiles, or follow back" on public.follows for insert to authenticated
  with check (
    follower_id = (select auth.uid())
    and (public.profile_is_public(followee_id) or public.is_followed_by(followee_id))
  );

create function public.are_friends(p_other uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = p_other)
     and exists (select 1 from public.follows f where f.follower_id = p_other and f.followee_id = (select auth.uid()));
$$;
revoke all on function public.are_friends(uuid) from public, anon;
grant execute on function public.are_friends(uuid) to authenticated;

-- What the caller may see of someone's contact details: each field only if its owner's setting
-- covers the caller. Signed-in travellers only; a visitor never gets anything. SECURITY DEFINER
-- because the table is closed to everyone but its owner.
create function public.profile_contact(p_user uuid)
returns table (contact_email text, phone text)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select
      (select auth.uid()) as id,
      public.are_friends(p_user) as friend,
      public.follows_user(p_user) as follower
  )
  select
    case when v.id = c.user_id
           or (c.email_audience = 'travellers' and public.profile_is_public(c.user_id))
           or (c.email_audience = 'followers' and (v.follower or v.friend))
           or (c.email_audience = 'friends' and v.friend)
         then c.contact_email end,
    case when v.id = c.user_id
           or (c.phone_audience = 'travellers' and public.profile_is_public(c.user_id))
           or (c.phone_audience = 'followers' and (v.follower or v.friend))
           or (c.phone_audience = 'friends' and v.friend)
         then c.phone end
  from public.profile_contacts c, viewer v
  where c.user_id = p_user and v.id is not null;
$$;
revoke all on function public.profile_contact(uuid) from public, anon;
grant execute on function public.profile_contact(uuid) to authenticated;

-- Everyone connected to the caller by a follow in either direction, with just enough to list them.
-- SECURITY DEFINER so a follower with a private profile can still be named and followed back.
create function public.my_connections()
returns table (
  user_id uuid,
  display_name text,
  handle text,
  is_public boolean,
  i_follow boolean,
  follows_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.handle, p.is_public,
         exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.followee_id = p.id),
         exists (select 1 from public.follows f where f.follower_id = p.id and f.followee_id = (select auth.uid()))
  from public.profiles p
  where p.id in (
    select f.followee_id from public.follows f where f.follower_id = (select auth.uid())
    union
    select f.follower_id from public.follows f where f.followee_id = (select auth.uid())
  )
  order by p.display_name;
$$;
revoke all on function public.my_connections() from public, anon;
grant execute on function public.my_connections() to authenticated;

-- Invites a friend to a trip without needing their handle. Owner only, friends only.
create function public.invite_friend(p_trip uuid, p_friend uuid, p_role public.trip_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_trip_owner(p_trip) then
    raise exception 'only the owner invites' using errcode = '42501';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'invites are for editors or viewers' using errcode = '22023';
  end if;
  if not public.are_friends(p_friend) then
    raise exception 'that traveller is not a friend' using errcode = '42501';
  end if;
  if exists (select 1 from public.trip_members where trip_id = p_trip and user_id = p_friend) then
    return;
  end if;
  insert into public.trip_person_invites (trip_id, invitee, invited_by, role)
  values (p_trip, p_friend, (select auth.uid()), p_role)
  on conflict (trip_id, invitee) do update set role = excluded.role, status = 'pending', invited_by = excluded.invited_by;
end;
$$;
revoke all on function public.invite_friend(uuid, uuid, public.trip_role) from public, anon;
grant execute on function public.invite_friend(uuid, uuid, public.trip_role) to authenticated;
