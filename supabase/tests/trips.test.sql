-- Privacy and integrity checks for trips, their days and stops, and proposals.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'traveller.one@example.com', '{"display_name": "Ana"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'traveller.two@example.com', '{"display_name": "Ben"}', 'authenticated', 'authenticated');
insert into public.cities (geoname_id, name, ascii_name, country_code, latitude, longitude, population)
values (990000001, 'Testlisbon', 'Testlisbon', 'PT', 38.7, -9.1, 500000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

-- Ana composes a two-day trip with three stops.
create temporary table ids on commit drop as
select public.create_trip(
  '{"city_id": 990000001, "title": "Testlisbon weekend", "start_date": "2026-11-13", "day_count": 2, "pace": "balanced", "budget": "comfortable", "currency": "EUR"}',
  '[{"day_index": 0, "title": "Castle hill", "title_source": "rules", "mode": "walking", "route": null},
    {"day_index": 1, "title": null, "title_source": null, "mode": "walking", "route": null}]',
  '[{"day_index": 0, "position": 0, "source_key": "osm:node/1", "place": {"name": "Castelo"}, "dwell_minutes": 90, "price_level": 1},
    {"day_index": 0, "position": 1, "source_key": "osm:node/2", "place": {"name": "Miradouro"}, "dwell_minutes": 30, "price_level": 0},
    {"day_index": 1, "position": 0, "source_key": "osm:way/3", "place": {"name": "Mercado"}, "dwell_minutes": 60, "price_level": 2}]'
) as trip_id;

select is((select count(*)::int from public.trips), 1, 'create_trip makes the trip');
select is((select count(*)::int from public.trip_days), 2, 'create_trip makes every day');
select is((select count(*)::int from public.trip_stops), 3, 'create_trip makes every stop');
select is((select user_id from public.trips limit 1), '11111111-1111-4111-8111-111111111111'::uuid, 'the trip belongs to its creator');

select throws_ok($$ select public.create_trip(
  '{"city_id": 990000001, "title": "Broken", "start_date": "2026-11-13", "day_count": 1, "pace": "balanced", "budget": "comfortable", "currency": "EUR"}',
  '[{"day_index": 0, "mode": "walking"}]',
  '[{"day_index": 5, "position": 0, "source_key": "osm:node/9", "place": {}, "dwell_minutes": 60, "price_level": 1}]') $$,
  '23503', null, 'a stop on a missing day is refused');
select is((select count(*)::int from public.trips), 1, 'a failed create_trip leaves nothing behind');

select throws_ok($$ insert into public.trips (city_id, title, start_date, day_count, pace, budget, currency) values (990000001, 'Too long', '2026-11-13', 30, 'slow', 'comfortable', 'EUR') $$,
  '23514', null, 'trips are 1 to 14 days');
select throws_ok($$ insert into public.trips (city_id, title, start_date, day_count, pace, budget, currency) values (990000001, 'Bad money', '2026-11-13', 2, 'slow', 'comfortable', 'euro') $$,
  '23514', null, 'currencies are ISO codes');
select throws_ok($$ update public.trip_stops set price_level = 9 $$, '23514', null, 'price levels are 0 to 3');

-- Rearranging: move the market to day 1 and drop the viewpoint.
select lives_ok(format($$ select public.arrange_trip(%L,
  (select jsonb_agg(jsonb_build_object('id', id, 'day_index', 0, 'position', case source_key when 'osm:node/1' then 0 else 1 end))
     from public.trip_stops where source_key in ('osm:node/1', 'osm:way/3')),
  array[(select id from public.trip_stops where source_key = 'osm:node/2')]) $$, (select trip_id from ids)),
  'owner can rearrange a trip');
select is((select string_agg(source_key, ',' order by day_index, position) from public.trip_stops), 'osm:node/1,osm:way/3', 'stops land where the layout says');
select throws_ok(format($$ select public.arrange_trip(%L,
  (select jsonb_agg(jsonb_build_object('id', id, 'day_index', 0, 'position', 0)) from public.trip_stops where source_key = 'osm:node/1')) $$, (select trip_id from ids)),
  '22023', null, 'a layout that leaves out a stop is refused');
select is((select count(*)::int from public.trip_stops), 2, 'a refused layout loses no stops');

insert into public.proposals (trip_id, request, source, summary, changes)
select trip_id, 'Make day 1 slower', 'rules', 'Moves one stop', '[]' from ids;
select throws_ok($$ insert into public.proposals (trip_id, request, source, summary, changes) select trip_id, 'x', 'rules', 'x', '{}' from ids $$,
  '23514', null, 'proposal changes must be a list');
select throws_ok($$ update public.trip_stops set source_key = 'osm:node/77' $$, '42501', null, 'a stop''s place cannot be rewritten');

-- Ben cannot see, change or extend Ana's trip.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.trips) + (select count(*)::int from public.trip_stops) + (select count(*)::int from public.proposals), 0, 'trips, stops and proposals are private');
select throws_ok(format($$ insert into public.trip_stops (trip_id, day_index, position, source_key, place, dwell_minutes, price_level) values (%L, 0, 5, 'osm:node/50', '{}', 60, 1) $$, (select trip_id from ids)),
  '42501', null, 'nobody can add stops to someone else''s trip');
select throws_ok(format($$ select public.arrange_trip(%L, '[]') $$, (select trip_id from ids)),
  '42501', null, 'nobody can rearrange someone else''s trip');
update public.trips set title = 'Taken over';
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select is((select title from public.trips limit 1), 'Testlisbon weekend', 'nobody can rename someone else''s trip');

reset role;
set local role anon;
select throws_ok($$ select count(*) from public.trips $$, '42501', null, 'visitors cannot read trips');

select * from finish();
rollback;
