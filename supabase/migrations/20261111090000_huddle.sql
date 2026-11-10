-- Huddle: trips shared between travellers. Members with roles, invite links and invites by handle,
-- votes, Group Drift (a shared deck and everyone's swipes), and a live signal for Realtime: every
-- change to a trip touches its row, which members receive through Realtime.
--
-- Roles: owner (everything, including members and deleting), editor (changes the plan), viewer
-- (sees the trip, swipes in Group Drift and votes). Joining a trip shares a member's display name,
-- pace and top three interests with the other members; nothing else about them.

create type public.trip_role as enum ('owner', 'editor', 'viewer');

-- Bumped by every change to the plan (days and stops), so a save based on an older plan is refused.
alter table public.trips add column plan_revision integer not null default 0;

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.trip_role not null,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user on public.trip_members (user_id);
create unique index trip_members_one_owner on public.trip_members (trip_id) where role = 'owner';

-- Trips made before Huddle: their creator becomes their owner.
insert into public.trip_members (trip_id, user_id, role)
select id, user_id, 'owner' from public.trips;

/* ---------- Who may do what (SECURITY DEFINER so policies can ask without recursion) ---------- */

create function public.trip_role_of(p_trip uuid)
returns public.trip_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.trip_members where trip_id = p_trip and user_id = (select auth.uid());
$$;

create function public.is_trip_member(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.trip_role_of(p_trip) is not null;
$$;

create function public.can_edit_trip(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.trip_role_of(p_trip) in ('owner', 'editor'), false);
$$;

create function public.is_trip_owner(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.trip_role_of(p_trip) = 'owner', false);
$$;

-- A new trip's creator is its owner. SECURITY DEFINER: travellers cannot insert memberships.
create function public.add_trip_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role) values (new.id, new.user_id, 'owner');
  return new;
end;
$$;
create trigger trips_add_owner after insert on public.trips
  for each row execute function public.add_trip_owner();

/* ---------- Trips, days, stops and proposals: from owner-only to members by role ---------- */

drop policy "Trips belong to their owner" on public.trips;
drop policy "Trip days belong to the trip's owner" on public.trip_days;
drop policy "Trip stops belong to the trip's owner" on public.trip_stops;
drop policy "Proposals belong to the trip's owner" on public.proposals;

create policy "Members see their trips" on public.trips for select to authenticated
  using (public.is_trip_member(id));
create policy "Travellers create their own trips" on public.trips for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Editors change trips" on public.trips for update to authenticated
  using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));
create policy "Owners delete trips" on public.trips for delete to authenticated
  using (public.is_trip_owner(id));

create policy "Members see trip days" on public.trip_days for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "Editors add trip days" on public.trip_days for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_edit_trip(trip_id));
create policy "Editors change trip days" on public.trip_days for update to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy "Editors remove trip days" on public.trip_days for delete to authenticated
  using (public.can_edit_trip(trip_id));

create policy "Members see trip stops" on public.trip_stops for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "Editors add trip stops" on public.trip_stops for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_edit_trip(trip_id));
create policy "Editors change trip stops" on public.trip_stops for update to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy "Editors remove trip stops" on public.trip_stops for delete to authenticated
  using (public.can_edit_trip(trip_id));

create policy "Members see proposals" on public.proposals for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "Editors ask for proposals" on public.proposals for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_edit_trip(trip_id));
create policy "Editors decide proposals" on public.proposals for update to authenticated
  using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));
create policy "Editors remove proposals" on public.proposals for delete to authenticated
  using (public.can_edit_trip(trip_id));

-- Proposals can now carry per-member notes (Consensus explains its trade-offs).
alter table public.proposals
  add column details jsonb not null default '[]'
    constraint proposals_details_array check (jsonb_typeof(details) = 'array' and pg_column_size(details) < 16384);
grant insert (details) on table public.proposals to authenticated;

/* ---------- Members ---------- */

alter table public.trip_members enable row level security;
revoke all on table public.trip_members from anon, authenticated;
grant select, delete on table public.trip_members to authenticated;
grant update (role) on table public.trip_members to authenticated;

create policy "Members see each other" on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id));
-- The owner sets other members' roles; nobody can make or unmake an owner here.
create policy "Owners set roles" on public.trip_members for update to authenticated
  using (public.is_trip_owner(trip_id) and role <> 'owner')
  with check (public.is_trip_owner(trip_id) and role <> 'owner');
-- The owner removes members; anyone but the owner can leave.
create policy "Owners remove members and members leave" on public.trip_members for delete to authenticated
  using (role <> 'owner' and (public.is_trip_owner(trip_id) or (select auth.uid()) = user_id));

/* ---------- Invite links: only a hash of the secret is stored ---------- */

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  role public.trip_role not null constraint trip_invites_role_not_owner check (role in ('editor', 'viewer')),
  token_hash text not null unique constraint trip_invites_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index trip_invites_trip on public.trip_invites (trip_id);

alter table public.trip_invites enable row level security;
revoke all on table public.trip_invites from anon, authenticated;
grant select on table public.trip_invites to authenticated;
grant insert (trip_id, created_by, role, token_hash) on table public.trip_invites to authenticated;
grant update (revoked_at) on table public.trip_invites to authenticated;

create policy "Owners see invite links" on public.trip_invites for select to authenticated
  using (public.is_trip_owner(trip_id));
create policy "Owners create invite links" on public.trip_invites for insert to authenticated
  with check ((select auth.uid()) = created_by and public.is_trip_owner(trip_id));
create policy "Owners revoke invite links" on public.trip_invites for update to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));

create function public.invite_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

-- What a link invites to, shown before joining. Only to signed-in travellers holding the secret.
create function public.invite_preview(p_token text)
returns table (
  trip_id uuid,
  title text,
  city_name text,
  start_date date,
  day_count smallint,
  role public.trip_role,
  inviter text,
  usable boolean,
  already_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title, c.name, t.start_date, t.day_count, i.role, p.display_name,
         i.revoked_at is null and i.expires_at > now(),
         exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = (select auth.uid()))
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  join public.cities c on c.geoname_id = t.city_id
  join public.profiles p on p.id = i.created_by
  where i.token_hash = public.invite_hash(p_token) and (select auth.uid()) is not null;
$$;

-- Joins a trip with a link. An existing member keeps their role (a link never demotes or promotes).
create function public.accept_trip_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.trip_invites;
begin
  if (select auth.uid()) is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into invite from public.trip_invites where token_hash = public.invite_hash(p_token);
  if invite.id is null or invite.revoked_at is not null or invite.expires_at <= now() then
    raise exception 'invite not usable' using errcode = '22023';
  end if;
  insert into public.trip_members (trip_id, user_id, role)
  values (invite.trip_id, (select auth.uid()), invite.role)
  on conflict (trip_id, user_id) do nothing;
  update public.trip_person_invites set status = 'accepted'
  where trip_id = invite.trip_id and invitee = (select auth.uid()) and status = 'pending';
  return invite.trip_id;
end;
$$;

/* ---------- Invites by handle: addressed to one traveller, accepted or declined by them ---------- */

create table public.trip_person_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  invitee uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  role public.trip_role not null constraint trip_person_invites_role_not_owner check (role in ('editor', 'viewer')),
  status text not null default 'pending' constraint trip_person_invites_status_known check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (trip_id, invitee)
);
create index trip_person_invites_invitee on public.trip_person_invites (invitee, status);

alter table public.trip_person_invites enable row level security;
revoke all on table public.trip_person_invites from anon, authenticated;
grant select, delete on table public.trip_person_invites to authenticated;

create policy "Owners and invitees see invites" on public.trip_person_invites for select to authenticated
  using (public.is_trip_owner(trip_id) or (select auth.uid()) = invitee);
create policy "Owners cancel invites" on public.trip_person_invites for delete to authenticated
  using (public.is_trip_owner(trip_id));

-- Invites a traveller by handle. It answers the same way whether or not the handle exists, so it
-- can't be used to discover who has an account.
create function public.invite_by_handle(p_trip uuid, p_handle text, p_role public.trip_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
begin
  if not public.is_trip_owner(p_trip) then
    raise exception 'only the owner invites' using errcode = '42501';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'invites are for editors or viewers' using errcode = '22023';
  end if;
  select id into target from public.profiles where handle = lower(trim(p_handle));
  if target is null or target = (select auth.uid())
     or exists (select 1 from public.trip_members where trip_id = p_trip and user_id = target) then
    return;
  end if;
  insert into public.trip_person_invites (trip_id, invitee, invited_by, role)
  values (p_trip, target, (select auth.uid()), p_role)
  on conflict (trip_id, invitee) do update set role = excluded.role, status = 'pending', invited_by = excluded.invited_by;
end;
$$;

-- The caller's pending invitations, with what they need to decide.
create function public.my_trip_invitations()
returns table (
  id uuid,
  trip_id uuid,
  title text,
  city_name text,
  start_date date,
  day_count smallint,
  role public.trip_role,
  inviter text
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, t.id, t.title, c.name, t.start_date, t.day_count, i.role, p.display_name
  from public.trip_person_invites i
  join public.trips t on t.id = i.trip_id
  join public.cities c on c.geoname_id = t.city_id
  join public.profiles p on p.id = i.invited_by
  where i.invitee = (select auth.uid()) and i.status = 'pending'
  order by i.created_at desc;
$$;

create function public.respond_to_trip_invitation(p_invite uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.trip_person_invites;
begin
  select * into invite from public.trip_person_invites
  where id = p_invite and invitee = (select auth.uid()) and status = 'pending';
  if invite.id is null then
    raise exception 'invitation not found' using errcode = '22023';
  end if;
  update public.trip_person_invites set status = case when p_accept then 'accepted' else 'declined' end
  where id = invite.id;
  if p_accept then
    insert into public.trip_members (trip_id, user_id, role)
    values (invite.trip_id, invite.invitee, invite.role)
    on conflict (trip_id, user_id) do nothing;
    return invite.trip_id;
  end if;
  return null;
end;
$$;

-- What members share with each other: name, role, pace and top three interests. Nothing else.
create function public.trip_member_profiles(p_trip uuid)
returns table (
  user_id uuid,
  display_name text,
  role public.trip_role,
  pace public.travel_pace,
  top_interests text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, p.display_name, m.role, d.pace,
         coalesce(array(
           select w.key from jsonb_each_text(d.interest_weights) w
           where w.value::numeric > 0
           order by w.value::numeric desc, w.key
           limit 3
         ), '{}')
  from public.trip_members m
  join public.profiles p on p.id = m.user_id
  left join public.travel_dna d on d.user_id = m.user_id
  where m.trip_id = p_trip and public.is_trip_member(p_trip)
  order by (m.role = 'owner') desc, m.joined_at;
$$;

/* ---------- Votes ---------- */

create table public.trip_votes (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- What the vote is on: a proposal, or a place to add.
  subject text not null constraint trip_votes_subject_format check (subject ~ '^(proposal:[0-9a-f-]{36}|place:(osm:(node|way|relation)/[0-9]+|wikipedia:[0-9]+))$'),
  value smallint not null constraint trip_votes_value_known check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id, subject)
);

alter table public.trip_votes enable row level security;
revoke all on table public.trip_votes from anon, authenticated;
grant select, delete on table public.trip_votes to authenticated;
-- Upserts re-send every column, so update covers them all; the policy pins each row to its voter.
grant insert (trip_id, user_id, subject, value), update (trip_id, user_id, subject, value)
  on table public.trip_votes to authenticated;

create policy "Members see votes" on public.trip_votes for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "Members cast their own votes" on public.trip_votes for all to authenticated
  using ((select auth.uid()) = user_id and public.is_trip_member(trip_id))
  with check ((select auth.uid()) = user_id and public.is_trip_member(trip_id));

/* ---------- Group Drift ---------- */

-- Today's shared deck of places in the trip's city, built by whichever member opens it first.
create table public.group_decks (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  built_on date not null default current_date,
  cards jsonb not null constraint group_decks_cards_array check (jsonb_typeof(cards) = 'array' and pg_column_size(cards) < 262144),
  created_at timestamptz not null default now()
);

alter table public.group_decks enable row level security;
revoke all on table public.group_decks from anon, authenticated;
grant select on table public.group_decks to authenticated;
grant insert (trip_id, built_on, cards), update (trip_id, built_on, cards) on table public.group_decks to authenticated;

create policy "Members see the group deck" on public.group_decks for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "Members build the group deck" on public.group_decks for insert to authenticated
  with check (public.is_trip_member(trip_id));
create policy "Members refresh the group deck" on public.group_decks for update to authenticated
  using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

create table public.group_swipes (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  source_key text not null constraint group_swipes_source_key_format check (source_key ~ '^(osm:(node|way|relation)/[0-9]+|wikipedia:[0-9]+)$'),
  verdict public.dna_reaction not null,
  card jsonb not null constraint group_swipes_card_object check (jsonb_typeof(card) = 'object' and pg_column_size(card) < 16384),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id, source_key)
);

alter table public.group_swipes enable row level security;
revoke all on table public.group_swipes from anon, authenticated;
grant select, delete on table public.group_swipes to authenticated;
grant insert (trip_id, user_id, source_key, verdict, card),
      update (trip_id, user_id, source_key, verdict, card)
  on table public.group_swipes to authenticated;

create policy "Members see the group's swipes" on public.group_swipes for select to authenticated
  using (public.is_trip_member(trip_id));
create policy "Members swipe for themselves" on public.group_swipes for all to authenticated
  using ((select auth.uid()) = user_id and public.is_trip_member(trip_id))
  with check ((select auth.uid()) = user_id and public.is_trip_member(trip_id));

/* ---------- The live signal ---------- */

-- Any change to a trip's parts touches the trip row (members receive it through Realtime). Changes
-- to days and stops also bump plan_revision. SECURITY DEFINER: viewers who vote or swipe have no
-- update right on trips.
create function public.signal_trip_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := case when tg_op = 'DELETE' then old.trip_id else new.trip_id end;
begin
  update public.trips
  set plan_revision = plan_revision + case when tg_argv[0] = 'plan' then 1 else 0 end,
      updated_at = now()
  where id = target;
  return null;
end;
$$;

create trigger trip_days_signal after insert or update or delete on public.trip_days
  for each row execute function public.signal_trip_change('plan');
create trigger trip_stops_signal after insert or update or delete on public.trip_stops
  for each row execute function public.signal_trip_change('plan');
create trigger proposals_signal after insert or update or delete on public.proposals
  for each row execute function public.signal_trip_change('activity');
create trigger trip_votes_signal after insert or update or delete on public.trip_votes
  for each row execute function public.signal_trip_change('activity');
create trigger group_swipes_signal after insert or update or delete on public.group_swipes
  for each row execute function public.signal_trip_change('activity');
create trigger trip_members_signal after insert or update or delete on public.trip_members
  for each row execute function public.signal_trip_change('activity');

alter publication supabase_realtime add table public.trips;

-- Presence and live updates travel on a private channel per trip ("trip:<id>"), open to its members only.
create function public.trip_topic_member(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_topic ~ '^trip:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_trip_member(substr(p_topic, 6)::uuid)
    else false
  end;
$$;

create policy "Trip members receive their trip's channel" on realtime.messages for select to authenticated
  using (public.trip_topic_member((select realtime.topic())));
create policy "Trip members share presence on their trip's channel" on realtime.messages for insert to authenticated
  with check (public.trip_topic_member((select realtime.topic())));

/* ---------- Rearranging, now for editors and with a plan revision check ---------- */

drop function public.arrange_trip(uuid, jsonb, uuid[], jsonb);

-- As before, plus: editors (not just the owner) may rearrange, and a save based on an older plan
-- (someone else changed it meanwhile) is refused so it can't silently undo their change.
create function public.arrange_trip(
  p_trip uuid,
  p_layout jsonb,
  p_revision integer,
  p_remove uuid[] default '{}',
  p_add jsonb default '[]'
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected integer;
  listed integer;
  current_revision integer;
begin
  if not public.can_edit_trip(p_trip) then
    raise exception 'trip not found' using errcode = '42501';
  end if;
  select plan_revision into current_revision from public.trips where id = p_trip for update;
  if current_revision <> p_revision then
    raise exception 'trip changed' using errcode = '40001';
  end if;

  delete from public.trip_stops where trip_id = p_trip and id = any (p_remove);

  insert into public.trip_stops (id, trip_id, day_index, position, source_key, place, dwell_minutes, price_level)
  select (s ->> 'id')::uuid, p_trip, (s ->> 'day_index')::smallint, (s ->> 'position')::smallint,
         s ->> 'source_key', s -> 'place', (s ->> 'dwell_minutes')::smallint, (s ->> 'price_level')::smallint
  from jsonb_array_elements(p_add) as s;

  select count(*) into expected from public.trip_stops where trip_id = p_trip;
  select count(distinct (l ->> 'id')) into listed
  from jsonb_array_elements(p_layout) as l
  join public.trip_stops ts on ts.id = (l ->> 'id')::uuid and ts.trip_id = p_trip;
  if listed <> expected or jsonb_array_length(p_layout) <> expected then
    raise exception 'layout must list every stop of the trip once' using errcode = '22023';
  end if;

  update public.trip_stops ts
  set day_index = (l ->> 'day_index')::smallint,
      position = (l ->> 'position')::smallint
  from jsonb_array_elements(p_layout) as l
  where ts.id = (l ->> 'id')::uuid and ts.trip_id = p_trip
    and (ts.day_index, ts.position) is distinct from ((l ->> 'day_index')::smallint, (l ->> 'position')::smallint);

  return (select plan_revision from public.trips where id = p_trip);
end;
$$;

drop function public.owns_trip(uuid);

revoke all on function public.trip_role_of(uuid) from public, anon;
revoke all on function public.is_trip_member(uuid) from public, anon;
revoke all on function public.can_edit_trip(uuid) from public, anon;
revoke all on function public.is_trip_owner(uuid) from public, anon;
revoke all on function public.add_trip_owner() from public, anon, authenticated;
revoke all on function public.signal_trip_change() from public, anon, authenticated;
revoke all on function public.invite_preview(text) from public, anon;
revoke all on function public.accept_trip_invite(text) from public, anon;
revoke all on function public.invite_by_handle(uuid, text, public.trip_role) from public, anon;
revoke all on function public.my_trip_invitations() from public, anon;
revoke all on function public.respond_to_trip_invitation(uuid, boolean) from public, anon;
revoke all on function public.trip_member_profiles(uuid) from public, anon;
revoke all on function public.trip_topic_member(text) from public, anon;
revoke all on function public.arrange_trip(uuid, jsonb, integer, uuid[], jsonb) from public, anon;

grant execute on function public.trip_role_of(uuid) to authenticated;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.can_edit_trip(uuid) to authenticated;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.invite_preview(text) to authenticated;
grant execute on function public.accept_trip_invite(text) to authenticated;
grant execute on function public.invite_by_handle(uuid, text, public.trip_role) to authenticated;
grant execute on function public.my_trip_invitations() to authenticated;
grant execute on function public.respond_to_trip_invitation(uuid, boolean) to authenticated;
grant execute on function public.trip_member_profiles(uuid) to authenticated;
grant execute on function public.trip_topic_member(text) to authenticated;
grant execute on function public.arrange_trip(uuid, jsonb, integer, uuid[], jsonb) to authenticated;
