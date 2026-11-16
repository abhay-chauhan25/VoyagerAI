-- Field Notes: follows, notes (a rating and a few words about a place, with photos), and trips
-- published as stories that others can fork. Everything starts private; the author chooses who
-- sees each note or story. Signed-in travellers only: nothing here is readable by visitors.

create type public.note_visibility as enum ('private', 'followers', 'public');

-- ---------- Follows ----------

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
create index follows_followee on public.follows (followee_id);

alter table public.follows enable row level security;
-- New tables start with broad default privileges; remove them and grant only what is needed.
revoke all on table public.follows from anon, authenticated;
grant select, delete on table public.follows to authenticated;
grant insert (followee_id) on table public.follows to authenticated;

create policy "Follows are visible to both people" on public.follows for select to authenticated
  using ((select auth.uid()) in (follower_id, followee_id));
-- Only public profiles can be followed, so following never reveals that a private account exists.
create policy "Travellers follow public profiles" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and public.profile_is_public(followee_id));
create policy "Either person can end a follow" on public.follows for delete to authenticated
  using ((select auth.uid()) in (follower_id, followee_id));

-- SECURITY DEFINER so the check works inside other tables' policies without exposing follow rows.
create function public.follows_user(p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.follows f
    where f.follower_id = (select auth.uid()) and f.followee_id = p_author
  );
$$;
revoke all on function public.follows_user(uuid) from public, anon;
grant execute on function public.follows_user(uuid) to authenticated;

-- The one rule for who sees a note or a story.
create function public.can_see(p_author uuid, p_visibility public.note_visibility)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_author = (select auth.uid())
      or p_visibility = 'public'
      or (p_visibility = 'followers' and public.follows_user(p_author));
$$;
revoke all on function public.can_see(uuid, public.note_visibility) from public, anon;
grant execute on function public.can_see(uuid, public.note_visibility) to authenticated;

-- Stamps the author's display name from their profile, so readers see a name without being able
-- to read the profile, and a client can never choose the name shown.
create function public.stamp_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.author_name := (select p.display_name from public.profiles p where p.id = new.user_id);
  return new;
end;
$$;
revoke all on function public.stamp_author() from public, anon, authenticated;

-- ---------- Notes ----------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  author_name text not null default '',
  trip_id uuid references public.trips (id) on delete set null,
  source_key text not null constraint notes_source_key_length check (char_length(source_key) between 1 and 200),
  place_name text not null constraint notes_place_name_length check (char_length(place_name) between 1 and 120),
  city_name text not null constraint notes_city_name_length check (char_length(city_name) between 1 and 120),
  rating smallint not null constraint notes_rating_range check (rating between 1 and 5),
  body text not null constraint notes_body_length check (char_length(body) between 1 and 2000),
  visibility public.note_visibility not null default 'private',
  created_at timestamptz not null default now()
);
create index notes_recent on public.notes (created_at desc);
create index notes_by_author on public.notes (user_id, created_at desc);

create trigger notes_stamp_author before insert on public.notes
  for each row execute function public.stamp_author();

alter table public.notes enable row level security;
-- New tables start with broad default privileges; remove them and grant only what is needed.
revoke all on table public.notes from anon, authenticated;
grant select, delete on table public.notes to authenticated;
grant insert (id, trip_id, source_key, place_name, city_name, rating, body, visibility)
  on table public.notes to authenticated;
grant update (rating, body, visibility) on table public.notes to authenticated;

create policy "Notes are seen by whoever their author allows" on public.notes for select to authenticated
  using (public.can_see(user_id, visibility));
-- A note about a trip's stop can only be written by someone on that trip.
create policy "Travellers write their own notes" on public.notes for insert to authenticated
  with check (user_id = (select auth.uid()) and (trip_id is null or public.is_trip_member(trip_id)));
create policy "Travellers edit their own notes" on public.notes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Travellers delete their own notes" on public.notes for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------- Photos ----------

create table public.note_photos (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Four photos a note: positions 0 to 3, each used once.
  position smallint not null constraint note_photos_position_range check (position between 0 and 3),
  path text not null unique,
  alt text not null default '' constraint note_photos_alt_length check (char_length(alt) <= 200),
  created_at timestamptz not null default now(),
  unique (note_id, position),
  -- A photo's file lives in its owner's folder, under its note.
  constraint note_photos_path_shape check (path ~ ('^' || user_id::text || '/' || note_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'))
);

alter table public.note_photos enable row level security;
-- New tables start with broad default privileges; remove them and grant only what is needed.
revoke all on table public.note_photos from anon, authenticated;
grant select, delete on table public.note_photos to authenticated;
grant insert (note_id, position, path, alt) on table public.note_photos to authenticated;

-- The subquery runs under the reader's own access to notes, so a photo is seen exactly when its note is.
create policy "Photos follow their note" on public.note_photos for select to authenticated
  using (exists (select 1 from public.notes n where n.id = note_id));
create policy "Authors add photos to their own notes" on public.note_photos for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.notes n where n.id = note_id and n.user_id = (select auth.uid()))
  );
create policy "Authors remove their own photos" on public.note_photos for delete to authenticated
  using (user_id = (select auth.uid()));

-- The files themselves: a private bucket, 5 MB a file, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('note-photos', 'note-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "Authors upload into their own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'note-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "A photo file is read when its note is" on storage.objects for select to authenticated
  using (
    bucket_id = 'note-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.note_photos p where p.path = name)
    )
  );
create policy "Authors delete their own photo files" on storage.objects for delete to authenticated
  using (bucket_id = 'note-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- Stories: trips their owner chose to publish ----------

create table public.trip_stories (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  author_name text not null default '',
  title text not null constraint trip_stories_title_length check (char_length(title) between 1 and 80),
  body text not null constraint trip_stories_body_length check (char_length(body) between 1 and 4000),
  visibility public.note_visibility not null default 'private',
  -- A copy of the plan taken when published: readers and forks use this, never the live trip.
  snapshot jsonb not null,
  published_at timestamptz not null default now()
);
create index trip_stories_recent on public.trip_stories (published_at desc);

create trigger trip_stories_stamp_author before insert on public.trip_stories
  for each row execute function public.stamp_author();

alter table public.trip_stories enable row level security;
-- New tables start with broad default privileges; remove them and grant only what is needed.
revoke all on table public.trip_stories from anon, authenticated;
grant select, delete on table public.trip_stories to authenticated;
grant update (title, body, visibility) on table public.trip_stories to authenticated;

create policy "Stories are seen by whoever their author allows" on public.trip_stories for select to authenticated
  using (public.can_see(user_id, visibility));
create policy "Authors edit their own stories" on public.trip_stories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Authors unpublish their own stories" on public.trip_stories for delete to authenticated
  using (user_id = (select auth.uid()));

-- Publishes (or republishes) a trip as a story. The plan is copied here, by the database, from the
-- trip itself, so a client cannot publish a plan that isn't the trip's. Only the places and days
-- are copied: never members, votes, proposals or notes. SECURITY DEFINER because travellers have
-- no direct insert on stories; the owner check is the first thing it does.
create function public.publish_trip_story(
  p_trip uuid,
  p_title text,
  p_body text,
  p_visibility public.note_visibility
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan jsonb;
begin
  if not public.is_trip_owner(p_trip) then
    raise exception 'only the owner can publish a trip' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'city_id', t.city_id,
    'city_name', c.name,
    'country_code', c.country_code,
    'day_count', t.day_count,
    'pace', t.pace,
    'budget', t.budget,
    'currency', t.currency,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object('day_index', d.day_index, 'title', d.title, 'mode', d.mode)
                       order by d.day_index)
      from public.trip_days d where d.trip_id = t.id), '[]'::jsonb),
    'stops', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day_index', s.day_index, 'position', s.position, 'source_key', s.source_key,
               'place', s.place, 'dwell_minutes', s.dwell_minutes, 'price_level', s.price_level)
             order by s.day_index, s.position)
      from public.trip_stops s where s.trip_id = t.id), '[]'::jsonb)
  )
  into plan
  from public.trips t join public.cities c on c.geoname_id = t.city_id
  where t.id = p_trip;

  insert into public.trip_stories (trip_id, user_id, title, body, visibility, snapshot)
  values (p_trip, (select auth.uid()), p_title, p_body, p_visibility, plan)
  on conflict (trip_id) do update
    set title = excluded.title, body = excluded.body, visibility = excluded.visibility,
        snapshot = excluded.snapshot, published_at = now();
  return p_trip;
end;
$$;
revoke all on function public.publish_trip_story(uuid, text, text, public.note_visibility) from public, anon;
grant execute on function public.publish_trip_story(uuid, text, text, public.note_visibility) to authenticated;

-- Forks: which of a traveller's trips began as someone's story.
create table public.story_forks (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  story_trip_id uuid references public.trip_stories (trip_id) on delete set null,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.story_forks enable row level security;
-- New tables start with broad default privileges; remove them and grant only what is needed.
revoke all on table public.story_forks from anon, authenticated;
grant select on table public.story_forks to authenticated;
grant insert (trip_id, story_trip_id) on table public.story_forks to authenticated;
create policy "Travellers see their own forks" on public.story_forks for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Travellers record their own forks" on public.story_forks for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_trip_owner(trip_id));

-- Copies a story the caller can see into a new trip of their own, starting on the date they pick,
-- at their own pace and budget when they have a Travel DNA. SECURITY INVOKER: the story is read
-- under the caller's access, and the trip is made by the same function that makes every trip.
create function public.fork_trip_story(p_story uuid, p_start date)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  story public.trip_stories%rowtype;
  mine public.travel_dna%rowtype;
  new_id uuid;
begin
  select * into story from public.trip_stories s where s.trip_id = p_story;
  if not found then
    raise exception 'that story is not available' using errcode = 'P0002';
  end if;
  select * into mine from public.travel_dna d where d.user_id = (select auth.uid());

  new_id := public.create_trip(
    jsonb_build_object(
      'city_id', story.snapshot -> 'city_id',
      'title', left(story.title, 80 - 9 - least(char_length(story.author_name), 30))
               || ' · after ' || left(story.author_name, 30),
      'start_date', p_start,
      'day_count', story.snapshot -> 'day_count',
      'pace', coalesce(mine.pace::text, story.snapshot ->> 'pace'),
      'budget', coalesce(mine.budget::text, story.snapshot ->> 'budget'),
      'currency', story.snapshot ->> 'currency'
    ),
    (select coalesce(jsonb_agg(jsonb_build_object(
              'day_index', d -> 'day_index', 'title', d -> 'title',
              'title_source', case when d ->> 'title' is null then null else 'rules' end,
              'mode', d -> 'mode')), '[]'::jsonb)
     from jsonb_array_elements(story.snapshot -> 'days') as d),
    story.snapshot -> 'stops'
  );
  insert into public.story_forks (trip_id, story_trip_id) values (new_id, p_story);
  return new_id;
end;
$$;
revoke all on function public.fork_trip_story(uuid, date) from public, anon;
grant execute on function public.fork_trip_story(uuid, date) to authenticated;

-- How many times a story has been forked; a count only, so nobody learns who forked it.
create function public.story_fork_count(p_story uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.story_forks f
  where f.story_trip_id = p_story
    and exists (select 1 from public.trip_stories s
                where s.trip_id = p_story and public.can_see(s.user_id, s.visibility));
$$;
revoke all on function public.story_fork_count(uuid) from public, anon;
grant execute on function public.story_fork_count(uuid) to authenticated;
