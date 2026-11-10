-- Shared trips: roles, invite links, invites by handle, votes, Group Drift, the live signal.
begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

-- Ana owns the trip; Ben joins by link as an editor; Kai is invited by handle as a viewer; Dee is
-- an outsider.
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'traveller.one@example.com', '{"display_name": "Ana"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'traveller.two@example.com', '{"display_name": "Ben"}', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'traveller.three@example.com', '{"display_name": "Kai"}', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-8444-444444444444', 'traveller.four@example.com', '{"display_name": "Dee"}', 'authenticated', 'authenticated');
update public.profiles set handle = 'kai_example' where id = '33333333-3333-4333-8333-333333333333';
insert into public.travel_dna (user_id, pace, budget, companions, interest_weights) values
  ('11111111-1111-4111-8111-111111111111', 'slow', 'comfortable', '{friends}', '{"Food": 0.9, "Wine": 0.7, "Art": 0.5, "Museums": 0.2, "Hiking": -0.6}');
insert into public.cities (geoname_id, name, ascii_name, country_code, latitude, longitude, population)
values (990000001, 'Testlisbon', 'Testlisbon', 'PT', 38.7, -9.1, 500000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
create temporary table ids on commit drop as
select public.create_trip(
  '{"city_id": 990000001, "title": "Group weekend", "start_date": "2026-11-13", "day_count": 2, "pace": "balanced", "budget": "comfortable", "currency": "EUR"}',
  '[{"day_index": 0, "mode": "walking"}, {"day_index": 1, "mode": "walking"}]',
  '[{"day_index": 0, "position": 0, "source_key": "osm:node/1", "place": {"name": "Castelo"}, "dwell_minutes": 90, "price_level": 1}]'
) as trip_id;
grant select on ids to authenticated;

select is(public.trip_role_of((select trip_id from ids)), 'owner'::public.trip_role, 'the creator owns the trip');
select ok((select plan_revision from public.trips) > 0, 'adding stops bumps the plan revision');

-- Invite links: only the owner makes them; only a hash is stored.
insert into public.trip_invites (trip_id, role, token_hash)
select trip_id, 'editor', public.invite_hash('secret-link-EXAMPLE') from ids;
-- An old link (expiry is set by the database, so the test backdates it as the database owner).
reset role;
insert into public.trip_invites (trip_id, created_by, role, token_hash, expires_at)
select trip_id, '11111111-1111-4111-8111-111111111111', 'viewer', public.invite_hash('old-link-EXAMPLE'), now() - interval '1 day' from ids;
set local role authenticated;
select is((select count(*)::int from public.trip_invites where token_hash ~ 'secret'), 0, 'secrets are never stored, only their hash');
select throws_ok($$ insert into public.trip_invites (trip_id, role, token_hash) select trip_id, 'owner', public.invite_hash('x') from ids $$,
  '23514', null, 'a link can never make an owner');

-- Ben, holding the secret, sees what he is joining and joins as an editor.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.trips), 0, 'before joining, the trip is invisible');
select is((select title from public.invite_preview('secret-link-EXAMPLE')), 'Group weekend', 'a valid link shows its trip');
select is((select count(*)::int from public.invite_preview('wrong-EXAMPLE')), 0, 'a wrong secret shows nothing');
select throws_ok($$ select public.accept_trip_invite('old-link-EXAMPLE') $$, '22023', null, 'an expired link is refused');
select throws_ok($$ insert into public.trip_invites (trip_id, role, token_hash) select trip_id, 'viewer', public.invite_hash('y') from ids $$,
  '42501', null, 'only the owner makes invite links');
select is(public.accept_trip_invite('secret-link-EXAMPLE'), (select trip_id from ids), 'a valid link joins the trip');
select is(public.trip_role_of((select trip_id from ids)), 'editor'::public.trip_role, 'with the role the link grants');

-- Ben edits the plan, but can't manage the trip.
select lives_ok(format($$ insert into public.trip_stops (trip_id, day_index, position, source_key, place, dwell_minutes, price_level) values (%L, 1, 0, 'osm:node/2', '{"name": "Mercado"}', 60, 1) $$, (select trip_id from ids)),
  'editors add stops');
select throws_ok(format($$ select public.arrange_trip(%L, '[]', 0) $$, (select trip_id from ids)),
  '40001', null, 'a save based on an older plan is refused');
delete from public.trips;
select is((select count(*)::int from public.trips), 1, 'editors cannot delete the trip');
update public.trip_members set role = 'owner' where user_id = '22222222-2222-4222-8222-222222222222';
select is(public.trip_role_of((select trip_id from ids)), 'editor'::public.trip_role, 'nobody makes themselves owner');

-- Ana invites Kai by handle. Unknown handles answer the same way and create nothing.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select lives_ok(format($$ select public.invite_by_handle(%L, 'Kai_Example', 'viewer') $$, (select trip_id from ids)), 'owners invite by handle');
select lives_ok(format($$ select public.invite_by_handle(%L, 'nobody_here', 'viewer') $$, (select trip_id from ids)), 'an unknown handle is not an error');
select is((select count(*)::int from public.trip_person_invites), 1, 'and creates nothing');
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select throws_ok(format($$ select public.invite_by_handle(%L, 'kai_example', 'editor') $$, (select trip_id from ids)),
  '42501', null, 'only the owner invites by handle');

select set_config('request.jwt.claims', '{"sub": "33333333-3333-4333-8333-333333333333", "role": "authenticated"}', true);
select is((select title from public.my_trip_invitations()), 'Group weekend', 'the invitee sees the invitation');
select is(public.respond_to_trip_invitation((select id from public.my_trip_invitations()), true), (select trip_id from ids), 'accepting joins the trip');
select is(public.trip_role_of((select trip_id from ids)), 'viewer'::public.trip_role, 'as a viewer');

-- Kai, a viewer, sees and takes part, but doesn't change the plan.
select is((select count(*)::int from public.trip_stops), 2, 'viewers see the plan');
select throws_ok(format($$ insert into public.trip_stops (trip_id, day_index, position, source_key, place, dwell_minutes, price_level) values (%L, 0, 1, 'osm:node/3', '{}', 60, 1) $$, (select trip_id from ids)),
  '42501', null, 'viewers cannot add stops');
update public.trips set title = 'Viewer title';
select is((select title from public.trips), 'Group weekend', 'viewers cannot rename the trip');
select lives_ok(format($$ insert into public.trip_votes (trip_id, subject, value) values (%L, 'place:osm:node/2', 1) $$, (select trip_id from ids)), 'viewers vote');
select throws_ok(format($$ insert into public.trip_votes (trip_id, user_id, subject, value) values (%L, '11111111-1111-4111-8111-111111111111', 'place:osm:node/2', -1) $$, (select trip_id from ids)),
  '42501', null, 'nobody votes for someone else');
select lives_ok(format($$ insert into public.group_swipes (trip_id, source_key, verdict, card) values (%L, 'osm:node/5', 'love', '{"name": "Park"}') $$, (select trip_id from ids)), 'viewers swipe in Group Drift');
-- The app saves votes and swipes as upserts, which re-send every column.
select lives_ok(format($$ insert into public.trip_votes (trip_id, user_id, subject, value) values (%L, '33333333-3333-4333-8333-333333333333', 'place:osm:node/2', -1)
  on conflict (trip_id, user_id, subject) do update set trip_id = excluded.trip_id, user_id = excluded.user_id, subject = excluded.subject, value = excluded.value $$, (select trip_id from ids)),
  'a vote can be changed with an upsert');
select lives_ok(format($$ insert into public.group_swipes (trip_id, user_id, source_key, verdict, card) values (%L, '33333333-3333-4333-8333-333333333333', 'osm:node/5', 'pass', '{"name": "Park"}')
  on conflict (trip_id, user_id, source_key) do update set trip_id = excluded.trip_id, user_id = excluded.user_id, source_key = excluded.source_key, verdict = excluded.verdict, card = excluded.card $$, (select trip_id from ids)),
  'a swipe can be changed with an upsert');

-- What members share: names, roles, pace and top three interests, nothing more.
select is((select top_interests from public.trip_member_profiles((select trip_id from ids)) where display_name = 'Ana'),
  array['Food', 'Wine', 'Art'], 'members see each other''s top three interests');
select is((select count(*)::int from public.trip_member_profiles((select trip_id from ids))), 3, 'and every member');
select ok(public.trip_topic_member('trip:' || (select trip_id from ids)), 'members may join the trip''s live channel');
select ok(not public.trip_topic_member('trip:not-a-uuid'), 'malformed channel names are refused');

-- Kai leaves; nobody can remove the owner.
delete from public.trip_members where user_id = '33333333-3333-4333-8333-333333333333';
select is(public.trip_role_of((select trip_id from ids)), null, 'members can leave');
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
delete from public.trip_members where user_id = '11111111-1111-4111-8111-111111111111';
select is(public.trip_role_of((select trip_id from ids)), 'owner'::public.trip_role, 'the owner cannot be removed');

-- Dee, an outsider, sees nothing.
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}', true);
select is((select count(*)::int from public.trip_members) + (select count(*)::int from public.trip_votes) + (select count(*)::int from public.group_swipes)
  + (select count(*)::int from public.trip_member_profiles((select trip_id from ids))), 0, 'outsiders see no members, votes, swipes or profiles');
select ok(not public.trip_topic_member('trip:' || (select trip_id from ids)), 'outsiders may not join the live channel');

select * from finish();
rollback;
