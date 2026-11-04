-- Row-level security checks for public.profiles. Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

-- Two synthetic users; the trigger should create a profile for each.
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('11111111-1111-4111-8111-111111111111', 'traveller.one@example.com', '{"display_name": "Ana"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'traveller.two@example.com', '{}', 'authenticated', 'authenticated');

select is(
  (select display_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Ana',
  'trigger uses the requested display name'
);
select is(
  (select display_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'traveller.two',
  'trigger falls back to the email local part'
);

-- Act as user one.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-4111-8111-111111111111", "role": "authenticated"}', true);

select is((select count(*)::int from public.profiles), 1, 'a user sees only their own profile');
select is(
  (select id::text from public.profiles),
  '11111111-1111-4111-8111-111111111111',
  'the visible profile is the user''s own'
);

update public.profiles set home_city = 'Porto' where id = '11111111-1111-4111-8111-111111111111';
select is(
  (select home_city from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Porto',
  'a user can update their own editable columns'
);

-- Updating someone else's row silently matches zero rows under RLS.
update public.profiles set display_name = 'Hijacked' where id = '22222222-2222-4222-8222-222222222222';
select throws_ok(
  $$ update public.profiles set id = '33333333-3333-4333-8333-333333333333' where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  null,
  'a user cannot change their profile id'
);
select throws_ok(
  $$ insert into public.profiles (id, display_name) values ('11111111-1111-4111-8111-111111111111', 'Dup') $$,
  '42501',
  null,
  'a user cannot insert profiles directly'
);
select throws_ok(
  $$ delete from public.profiles where id = '11111111-1111-4111-8111-111111111111' $$,
  '42501',
  null,
  'a user cannot delete profiles'
);
select throws_ok(
  $$ update public.profiles set display_name = '   ' where id = '11111111-1111-4111-8111-111111111111' $$,
  '23514',
  null,
  'a blank display name is rejected'
);

-- Anonymous visitors see nothing.
reset role;
set local role anon;
select throws_ok(
  $$ select * from public.profiles $$,
  '42501',
  null,
  'anon has no access to profiles'
);

reset role;
select is(
  (select display_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'traveller.two',
  'another user''s profile was not modified'
);

select * from finish();
rollback;
