-- Privacy and quota checks for Drift saves, cached decks and AI usage.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'traveller.one@example.com', '{"display_name": "Ana"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'traveller.two@example.com', '{"display_name": "Ben"}', 'authenticated', 'authenticated');
insert into public.cities (geoname_id, name, ascii_name, country_code, latitude, longitude, population)
values (990000001, 'Testlisbon', 'Testlisbon', 'PT', 38.7, -9.1, 500000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

insert into public.saves (kind, source_key, city_id, verdict, snapshot)
values ('destination', 'geonames:990000001', 990000001, 'love', '{"name": "Testlisbon"}');
select is((select count(*)::int from public.saves where user_id = '11111111-1111-4111-8111-111111111111'), 1, 'owner can save a card');
select throws_ok($$ insert into public.saves (kind, source_key, city_id, verdict, snapshot) values ('activity', 'http://evil', 990000001, 'love', '{}') $$,
  '23514', null, 'source keys must be a known format');
select throws_ok($$ insert into public.saves (kind, source_key, city_id, verdict, snapshot) values ('activity', 'osm:node/1', 990000001, 'love', '[]') $$,
  '23514', null, 'snapshots must be objects');
select throws_ok($$ insert into public.saves (user_id, kind, source_key, city_id, verdict, snapshot) values ('22222222-2222-4222-8222-222222222222', 'activity', 'osm:node/2', 990000001, 'love', '{}') $$,
  '42501', null, 'nobody can save for someone else');

insert into public.drift_decks (deck_key, source, cards) values ('destinations', 'compass', '[]');
select throws_ok($$ insert into public.drift_decks (deck_key, source, cards) values ('everything', 'compass', '[]') $$,
  '23514', null, 'deck keys must be a known format');

-- Quota: a limit of 2 allows two calls, refuses the third, and the counter stops at the limit.
select ok(public.consume_ai_quota(2), 'first AI call fits the quota');
select ok(public.consume_ai_quota(2), 'second AI call fits the quota');
select ok(not public.consume_ai_quota(2), 'third AI call is refused');
select is((select calls from public.ai_usage where user_id = '11111111-1111-4111-8111-111111111111'), 2, 'refused calls are not counted');
select throws_ok($$ insert into public.ai_usage (user_id, calls) values ('11111111-1111-4111-8111-111111111111', 0) $$,
  '42501', null, 'travellers cannot write usage directly');

-- Ben sees none of Ana's data and cannot change it.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.saves where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'saves are private');
select is((select count(*)::int from public.drift_decks where user_id = '11111111-1111-4111-8111-111111111111'), 0, 'decks are private');
select ok(public.consume_ai_quota(2), 'each traveller has their own quota');

reset role;
set local role anon;
select throws_ok($$ select public.consume_ai_quota(100) $$, '42501', null, 'visitors cannot use AI quota');

select * from finish();
rollback;
