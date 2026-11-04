-- Privacy and integrity checks for public profiles, Travel DNA and Atlas visits.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Synthetic fixtures: two travellers and two cities that cannot collide with GeoNames ids.
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'traveller.one@example.com', '{"display_name": "Ana"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'traveller.two@example.com', '{"display_name": "Ben"}', 'authenticated', 'authenticated');
insert into public.cities (geoname_id, name, ascii_name, country_code, region, latitude, longitude, population) values
  (990000001, 'Testlisbon', 'Testlisbon', 'PT', 'Lisboa', 38.7, -9.1, 500000),
  (990000002, 'Testkyoto', 'Testkyoto', 'JP', 'Kyoto', 35.0, 135.7, 1400000);

-- Handles
select throws_ok($$ update public.profiles set handle = 'No Spaces' where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514', null, 'handles must be lowercase letters, digits or underscores');

-- Act as Ana: set up DNA, reactions and visits on a private profile.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

update public.profiles set handle = 'ana_travels' where id = '11111111-1111-4111-8111-111111111111';
select is((select handle from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'ana_travels', 'owner can set a valid handle');

insert into public.travel_dna (user_id, pace, budget, companions, interest_weights)
values ('11111111-1111-4111-8111-111111111111', 'slow', 'comfortable', '{friends}', '{"Food": 0.9}');
select is((select pace::text from public.travel_dna where user_id = '11111111-1111-4111-8111-111111111111'), 'slow', 'owner can save Travel DNA');
select throws_ok($$ update public.travel_dna set companions = '{pets}' where user_id = '11111111-1111-4111-8111-111111111111' $$, '23514', null, 'unknown companions are rejected');
select throws_ok($$ update public.travel_dna set interest_weights = '[1,2]' where user_id = '11111111-1111-4111-8111-111111111111' $$, '23514', null, 'interest weights must be an object');

insert into public.dna_reactions (user_id, scene_id, reaction) values ('11111111-1111-4111-8111-111111111111', 'night-market', 'love');
select throws_ok($$ insert into public.dna_reactions (user_id, scene_id, reaction) values ('11111111-1111-4111-8111-111111111111', 'Bad Id!', 'love') $$,
  '23514', null, 'scene ids are validated');

-- Retaking the deck upserts: the owner can overwrite their own answers and Travel DNA...
insert into public.dna_reactions (user_id, scene_id, reaction) values ('11111111-1111-4111-8111-111111111111', 'night-market', 'pass')
  on conflict (user_id, scene_id) do update set user_id = excluded.user_id, scene_id = excluded.scene_id, reaction = excluded.reaction;
select is((select reaction::text from public.dna_reactions where scene_id = 'night-market' and user_id = '11111111-1111-4111-8111-111111111111'), 'pass', 'owner can upsert deck answers');
insert into public.travel_dna (user_id, pace, budget) values ('11111111-1111-4111-8111-111111111111', 'balanced', 'splurge')
  on conflict (user_id) do update set user_id = excluded.user_id, pace = excluded.pace, budget = excluded.budget;
update public.travel_dna set pace = 'slow' where user_id = '11111111-1111-4111-8111-111111111111';
select is((select budget::text from public.travel_dna where user_id = '11111111-1111-4111-8111-111111111111'), 'splurge', 'owner can upsert Travel DNA');
-- ...but can never hand a row to someone else.
select throws_ok($$ update public.dna_reactions set user_id = '22222222-2222-4222-8222-222222222222' where scene_id = 'night-market' $$,
  '42501', null, 'answers cannot be reassigned to another user');

-- The city decides the country, whatever the client sends.
insert into public.visits (country_code, city_id, visited_year) values ('FR', 990000001, 2024);
select is((select country_code::text from public.visits where city_id = 990000001 and user_id = '11111111-1111-4111-8111-111111111111'), 'PT', 'a city visit takes the city''s country');
insert into public.visits (country_code) values ('IS');
select is((select count(*)::int from public.visits where user_id = '11111111-1111-4111-8111-111111111111'), 2, 'owner can add city and country visits');
select throws_ok($$ insert into public.visits (country_code, city_id) values ('JP', 999999999) $$, '23503', null, 'unknown cities are rejected');
select throws_ok($$ insert into public.visits (country_code, city_id) values ('PT', 990000001) $$, '23505', null, 'the same city cannot be added twice');
select throws_ok($$ insert into public.visits (user_id, country_code) values ('22222222-2222-4222-8222-222222222222', 'ES') $$,
  '42501', null, 'nobody can add visits for someone else');
select throws_ok($$ insert into public.cities (geoname_id, name, ascii_name, country_code, latitude, longitude) values (1, 'x', 'x', 'PT', 0, 0) $$,
  '42501', null, 'travellers cannot write reference cities');

-- Act as Ben while Ana's profile is private.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 0, 'a private profile is hidden from other users');
select is((select count(*)::int from public.travel_dna where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'private Travel DNA is hidden from other users');
select is((select count(*)::int from public.visits where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'private visits are hidden from other users');
delete from public.visits where user_id = '11111111-1111-4111-8111-111111111111';
update public.travel_dna set pace = 'full' where user_id = '11111111-1111-4111-8111-111111111111';

-- Visitors see nothing private either.
reset role;
set local role anon;
select is((select count(*)::int from public.profiles where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')), 0, 'visitors see no private profiles');
select is((select count(*)::int from public.cities where geoname_id = 990000001), 1, 'visitors can read reference cities');
select is((select count(*)::int from public.search_cities('t', 5)), 0, 'one-letter searches return nothing');

-- Ana goes public.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
update public.profiles set is_public = true where id = '11111111-1111-4111-8111-111111111111';
select is((select count(*)::int from public.visits where user_id = '11111111-1111-4111-8111-111111111111'), 2, 'Ben''s delete attempt removed nothing');
select is((select pace::text from public.travel_dna where user_id = '11111111-1111-4111-8111-111111111111'), 'slow', 'Ben''s update attempt changed nothing');

reset role;
set local role anon;
select is((select display_name from public.profiles where handle = 'ana_travels'), 'Ana', 'visitors can read a public profile');
select is((select count(*)::int from public.visits where user_id = '11111111-1111-4111-8111-111111111111'), 2, 'visitors can read visits on a public profile');
select is((select count(*)::int from public.travel_dna where user_id = '11111111-1111-4111-8111-111111111111'), 1, 'visitors can read Travel DNA on a public profile');
select throws_ok($$ select * from public.dna_reactions $$, '42501', null, 'raw reactions stay private even on a public profile');

select * from finish();
rollback;
