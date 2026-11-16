-- Friends, contact details shared per field, inviting a friend, and places carried by proposals.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Ana is public and shares details; Ben is private; Kai is public; Dee is a stranger.
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'traveller.one@example.com', '{"display_name": "Ana"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'traveller.two@example.com', '{"display_name": "Ben"}', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'traveller.three@example.com', '{"display_name": "Kai"}', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-8444-444444444444', 'traveller.four@example.com', '{"display_name": "Dee"}', 'authenticated', 'authenticated');
update public.profiles set handle = 'ana_example', is_public = true where id = '11111111-1111-4111-8111-111111111111';
update public.profiles set handle = 'kai_example', is_public = true where id = '33333333-3333-4333-8333-333333333333';
insert into public.cities (geoname_id, name, ascii_name, country_code, latitude, longitude, population)
values (990000003, 'Testfaro', 'Testfaro', 'PT', 37.0, -7.9, 60000);

set local role authenticated;

-- Ana fills in her profile: email for friends, phone for followers.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select lives_ok($$ update public.profiles set bio = 'Slow traveller.', website = 'https://example.com/ana' where id = '11111111-1111-4111-8111-111111111111' $$,
  'a traveller sets their bio and link');
select throws_ok($$ update public.profiles set website = 'javascript:alert(1)' where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514', null, 'a link that is not https is refused');
select throws_ok($$ update public.profiles set bio = repeat('x', 281) where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514', null, 'a bio over the limit is refused');
select lives_ok($$ insert into public.profile_contacts (contact_email, phone, email_audience, phone_audience) values ('ana@example.com', '+351 21 000 0000', 'friends', 'followers') $$,
  'a traveller adds contact details');
select lives_ok($$ insert into public.profile_contacts (contact_email, phone, email_audience, phone_audience) values ('ana@example.com', '+351 21 000 0000', 'friends', 'followers')
  on conflict (user_id) do update set contact_email = excluded.contact_email, phone = excluded.phone, email_audience = excluded.email_audience, phone_audience = excluded.phone_audience $$,
  'and saves them again the way the app does');
select throws_ok($$ update public.profile_contacts set phone = 'call me maybe' $$,
  '23514', null, 'a phone number must look like one');
select throws_ok($$ update public.profile_contacts set contact_email = 'not-an-email' $$,
  '23514', null, 'an email must look like one');

-- Ben (private) follows Ana. She can follow back even though his profile is private.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
insert into public.follows (followee_id) values ('11111111-1111-4111-8111-111111111111');
select is((select count(*)::int from public.profile_contacts), 0, 'nobody reads another traveller''s contact row directly');
select is((select phone from public.profile_contact('11111111-1111-4111-8111-111111111111')), '+351 21 000 0000', 'a follower sees what is shared with followers');
select is((select contact_email from public.profile_contact('11111111-1111-4111-8111-111111111111')), null, 'but not what is for friends only');
select ok(not public.are_friends('11111111-1111-4111-8111-111111111111'), 'a one-way follow is not a friendship');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
select is((select display_name || '/' || follows_me::text || '/' || i_follow::text from public.my_connections()), 'Ben/true/false',
  'a follower with a private profile is still listed by name');
select throws_ok($$ insert into public.follows (followee_id) values ('44444444-4444-4444-8444-444444444444') $$,
  '42501', null, 'a private profile that has not followed you cannot be followed');
select lives_ok($$ insert into public.follows (followee_id) values ('22222222-2222-4222-8222-222222222222') $$,
  'following back works even though their profile is private');
select ok(public.are_friends('22222222-2222-4222-8222-222222222222'), 'following each other makes friends');

-- Friends see friends-only details. Strangers see nothing; a visitor has no access at all.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is((select contact_email from public.profile_contact('11111111-1111-4111-8111-111111111111')), 'ana@example.com', 'a friend sees friends-only details');
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-8444-444444444444", "role": "authenticated"}', true);
select is((select coalesce(contact_email, '') || coalesce(phone, '') from public.profile_contact('11111111-1111-4111-8111-111111111111')), '',
  'a stranger sees no contact details');
select is((select count(*)::int from public.my_connections()), 0, 'a stranger has no connections to list');
reset role;
select ok(not has_function_privilege('anon', 'public.profile_contact(uuid)', 'execute'), 'visitors cannot ask for contact details');
set local role authenticated;

-- Inviting a friend to a trip: owner only, friends only.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);
create temporary table ids on commit drop as
select public.create_trip(
  '{"city_id": 990000003, "title": "Faro", "start_date": "2027-02-01", "day_count": 1, "pace": "slow", "budget": "comfortable", "currency": "EUR"}',
  '[{"day_index": 0, "mode": "walking"}]', '[]'
) as trip_id;
grant select on ids to authenticated;
select lives_ok(format($$ select public.invite_friend(%L, '22222222-2222-4222-8222-222222222222', 'editor') $$, (select trip_id from ids)),
  'an owner invites a friend with one call');
select throws_ok(format($$ select public.invite_friend(%L, '33333333-3333-4333-8333-333333333333', 'editor') $$, (select trip_id from ids)),
  '42501', null, 'someone who is not a friend cannot be invited this way');
select lives_ok(format($$ insert into public.proposals (trip_id, request, source, summary, changes, places) values (%L, 'add more', 'rules', 'Adds a place.', '[]', '[{"name": "Mercado"}]') $$, (select trip_id from ids)),
  'a proposal can carry the places it suggests');

select set_config('request.jwt.claims', '{"sub": "22222222-2222-4222-8222-222222222222", "role": "authenticated"}', true);
select is((select count(*)::int from public.my_trip_invitations()), 1, 'the friend finds the invitation');
select throws_ok(format($$ select public.invite_friend(%L, '11111111-1111-4111-8111-111111111111', 'viewer') $$, (select trip_id from ids)),
  '42501', null, 'only the owner invites');

select * from finish();
rollback;
