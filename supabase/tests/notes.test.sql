-- Field Notes: follows, who sees a note, photos, publishing a trip as a story, and forking it.
-- Counts look only at Ana's rows, so notes already in a developer's database don't change them.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

-- Ana writes; Ben follows her; Kai is a stranger; Dee keeps a private profile.
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'traveller.one@example.com', '{"display_name": "Ana"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'traveller.two@example.com', '{"display_name": "Ben"}', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'traveller.three@example.com', '{"display_name": "Kai"}', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-8444-444444444444', 'traveller.four@example.com', '{"display_name": "Dee"}', 'authenticated', 'authenticated');
update public.profiles set handle = 'ana_example', is_public = true where id = '11111111-1111-4111-8111-111111111111';
insert into public.travel_dna (user_id, pace, budget, companions, interest_weights) values
  ('22222222-2222-4222-8222-222222222222', 'slow', 'shoestring', '{solo}', '{"Food": 0.9}');
insert into public.cities (geoname_id, name, ascii_name, country_code, latitude, longitude, population)
values (990000002, 'Testporto', 'Testporto', 'PT', 41.1, -8.6, 200000);

set local role authenticated;

-- Follows.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select lives_ok($$ insert into public.follows (followee_id) values ('11111111-1111-4111-8111-111111111111') $$,
  'a public profile can be followed');
select throws_ok($$ insert into public.follows (followee_id) values ('44444444-4444-4444-8444-444444444444') $$,
  '42501', null, 'a private profile cannot be followed');
select throws_ok($$ insert into public.follows (followee_id) values ('22222222-2222-4222-8222-222222222222') $$,
  null, null, 'nobody follows themselves');
select throws_ok($$ insert into public.follows (follower_id, followee_id) values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111') $$,
  '42501', null, 'a follow cannot be made in someone else''s name');

-- Ana makes a trip and writes three notes, one at each visibility.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
create temporary table ids on commit drop as
select public.create_trip(
  '{"city_id": 990000002, "title": "Porto weekend", "start_date": "2026-12-04", "day_count": 2, "pace": "full", "budget": "splurge", "currency": "EUR"}',
  '[{"day_index": 0, "mode": "walking"}, {"day_index": 1, "mode": "walking"}]',
  '[{"day_index": 0, "position": 0, "source_key": "osm:node/11", "place": {"name": "Ribeira"}, "dwell_minutes": 90, "price_level": 1},
    {"day_index": 1, "position": 0, "source_key": "osm:node/12", "place": {"name": "Livraria Lello"}, "dwell_minutes": 60, "price_level": 2}]'
) as trip_id;
grant select on ids to authenticated;

insert into public.notes (id, trip_id, source_key, place_name, city_name, rating, body, visibility) values
  ('aaaaaaaa-0000-4000-8000-000000000001', (select trip_id from ids), 'osm:node/11', 'Ribeira', 'Testporto', 5, 'Go at dusk.', 'private'),
  ('aaaaaaaa-0000-4000-8000-000000000002', (select trip_id from ids), 'osm:node/11', 'Ribeira', 'Testporto', 4, 'Busy by noon.', 'followers'),
  ('aaaaaaaa-0000-4000-8000-000000000003', null, 'osm:node/12', 'Livraria Lello', 'Testporto', 3, 'Book ahead.', 'public');
select is((select count(*)::int from public.notes where user_id = '11111111-1111-4111-8111-111111111111'), 3, 'an author sees all their own notes');
select is((select author_name from public.notes where id = 'aaaaaaaa-0000-4000-8000-000000000001'), 'Ana', 'the author''s name is stamped from their profile');
select throws_ok($$ insert into public.notes (source_key, place_name, city_name, rating, body) values ('osm:node/1', 'X', 'Y', 6, 'Too good.') $$,
  '23514', null, 'a rating above five is refused');
select throws_ok($$ insert into public.notes (source_key, place_name, city_name, rating, body) values ('osm:node/1', 'X', 'Y', 3, '') $$,
  '23514', null, 'an empty note is refused');
select throws_ok($$ insert into public.notes (source_key, place_name, city_name, rating, body, author_name) values ('osm:node/1', 'X', 'Y', 3, 'Hi', 'Somebody Else') $$,
  '42501', null, 'an author cannot choose the name shown');

-- Photos: in the author's own folder, four at most.
insert into public.note_photos (note_id, position, path) values
  ('aaaaaaaa-0000-4000-8000-000000000002', 0, '11111111-1111-4111-8111-111111111111/aaaaaaaa-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000001.jpg');
select throws_ok($$ insert into public.note_photos (note_id, position, path) values ('aaaaaaaa-0000-4000-8000-000000000002', 4, '11111111-1111-4111-8111-111111111111/aaaaaaaa-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000005.jpg') $$,
  '23514', null, 'a fifth photo is refused');
select throws_ok($$ insert into public.note_photos (note_id, position, path) values ('aaaaaaaa-0000-4000-8000-000000000002', 1, '22222222-2222-4222-8222-222222222222/aaaaaaaa-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000002.jpg') $$,
  '23514', null, 'a photo cannot point into someone else''s folder');
select throws_ok($$ insert into public.note_photos (note_id, position, path) values ('aaaaaaaa-0000-4000-8000-000000000002', 1, '11111111-1111-4111-8111-111111111111/aaaaaaaa-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000002.svg') $$,
  '23514', null, 'only image files are accepted');

-- Ben follows Ana: he sees her followers and public notes, never the private one.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.notes where user_id = '11111111-1111-4111-8111-111111111111'), 2, 'a follower sees followers-only and public notes');
select is((select count(*)::int from public.notes where user_id = '11111111-1111-4111-8111-111111111111' and visibility = 'private'), 0, 'a follower never sees a private note');
select is((select count(*)::int from public.note_photos where user_id = '11111111-1111-4111-8111-111111111111'), 1, 'a photo is seen when its note is');
select throws_ok($$ insert into public.note_photos (note_id, position, path) values ('aaaaaaaa-0000-4000-8000-000000000002', 1, '22222222-2222-4222-8222-222222222222/aaaaaaaa-0000-4000-8000-000000000002/bbbbbbbb-0000-4000-8000-000000000003.jpg') $$,
  '42501', null, 'photos can only be added to your own note');
select is_empty($$ update public.notes set body = 'Defaced' where id = 'aaaaaaaa-0000-4000-8000-000000000003' returning id $$,
  'a reader cannot edit someone else''s note');
select throws_ok(format($$ insert into public.notes (trip_id, source_key, place_name, city_name, rating, body) values (%L, 'osm:node/11', 'Ribeira', 'Testporto', 1, 'Never went.') $$, (select trip_id from ids)),
  '42501', null, 'a note cannot be tied to a trip its author is not on');

-- Kai is a stranger: public only.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.notes where user_id = '11111111-1111-4111-8111-111111111111'), 1, 'a stranger sees only public notes');
select is((select count(*)::int from public.note_photos where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'and no photos from notes they cannot see');
select is((select count(*)::int from public.follows), 0, 'other people''s follows are not visible');

-- Stories: only the owner publishes; the plan is copied by the database.
select throws_ok(format($$ select public.publish_trip_story(%L, 'Stolen', 'Mine now.', 'public') $$, (select trip_id from ids)),
  '42501', null, 'only the owner can publish a trip');
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select lives_ok(format($$ select public.publish_trip_story(%L, 'Two days in Porto', 'River first, books second.', 'followers') $$, (select trip_id from ids)),
  'the owner publishes a trip as a story');
select is((select jsonb_array_length(snapshot -> 'stops') from public.trip_stories where trip_id = (select trip_id from ids)), 2, 'the story carries a copy of the plan');
select throws_ok($$ insert into public.trip_stories (trip_id, title, body, snapshot) select trip_id, 'T', 'B', '{}' from ids $$,
  '42501', null, 'a story cannot be inserted directly with a made-up plan');

select set_config('request.jwt.claims', '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}', true);
select is((select count(*)::int from public.trip_stories where trip_id = (select trip_id from ids)), 0, 'a followers-only story is hidden from strangers');
select throws_ok(format($$ select public.fork_trip_story(%L, '2027-01-10') $$, (select trip_id from ids)),
  'P0002', null, 'a story you cannot see cannot be forked');

-- Ben can see it and forks it: his own trip, his own pace, none of Ana's trip beyond places and days.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
create temporary table forked on commit drop as
select public.fork_trip_story((select trip_id from ids), '2027-01-10') as trip_id;
grant select on forked to authenticated;
select is((select count(*)::int from public.trip_stops where trip_id = (select trip_id from forked)), 2, 'a fork copies the stops');
select is((select pace::text || '/' || title from public.trips where id = (select trip_id from forked)),
  'slow/Two days in Porto · after Ana', 'a fork takes the forker''s pace and credits the author');
select is((select count(*)::int from public.trips), 1, 'forking gives no access to the original trip');

select * from finish();
rollback;
