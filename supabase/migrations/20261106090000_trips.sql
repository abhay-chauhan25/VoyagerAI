-- Trips: day-by-day plans composed from a traveller's saves, and Compass's proposed changes to them.
-- Every row belongs to one traveller. Place details are a snapshot per stop (as in saves), so no
-- shared, writable place cache exists.

create type public.travel_mode as enum ('walking', 'driving');
create type public.proposal_status as enum ('pending', 'applied', 'dismissed');

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  city_id integer not null references public.cities (geoname_id) on delete restrict,
  title text not null constraint trips_title_length check (char_length(title) between 1 and 80),
  start_date date not null,
  day_count smallint not null constraint trips_day_count_range check (day_count between 1 and 14),
  pace public.travel_pace not null,
  budget public.budget_band not null,
  currency text not null constraint trips_currency_format check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trips_user_created on public.trips (user_id, created_at desc);

create table public.trip_days (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day_index smallint not null constraint trip_days_index_range check (day_index between 0 and 13),
  title text constraint trip_days_title_length check (char_length(title) between 1 and 60),
  title_source text constraint trip_days_title_source_known check (title_source in ('compass', 'rules')),
  mode public.travel_mode not null default 'walking',
  -- Travel times and the route line for the stops in their current order; recomputed when the
  -- order changes. Validated by the app's schema before every write.
  route jsonb constraint trip_days_route_object check (route is null or (jsonb_typeof(route) = 'object' and pg_column_size(route) < 262144)),
  primary key (trip_id, day_index)
);

create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day_index smallint not null,
  position smallint not null constraint trip_stops_position_range check (position between 0 and 49),
  source_key text not null constraint trip_stops_source_key_format check (source_key ~ '^(osm:(node|way|relation)/[0-9]+|wikipedia:[0-9]+)$'),
  -- The place as it was saved (name, category, coordinates, hours, photo).
  place jsonb not null constraint trip_stops_place_object check (jsonb_typeof(place) = 'object' and pg_column_size(place) < 16384),
  dwell_minutes smallint not null constraint trip_stops_dwell_range check (dwell_minutes between 15 and 480),
  -- 0 free, 1 $, 2 $$, 3 $$$: a guess from the place type that the traveller can change.
  price_level smallint not null constraint trip_stops_price_level_range check (price_level between 0 and 3),
  -- Optional exact amount, in the trip's currency.
  cost_amount numeric(10, 2) constraint trip_stops_cost_non_negative check (cost_amount is null or cost_amount between 0 and 99999999),
  created_at timestamptz not null default now(),
  -- A stop always sits on a day that exists; removing a day never silently deletes its stops.
  -- (NO ACTION is checked at the end of the statement, so deleting a whole trip still cascades.)
  foreign key (trip_id, day_index) references public.trip_days (trip_id, day_index) on delete no action,
  unique (trip_id, source_key)
);
create index trip_stops_trip_order on public.trip_stops (trip_id, day_index, position);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  request text not null constraint proposals_request_length check (char_length(request) between 1 and 300),
  source text not null constraint proposals_source_known check (source in ('compass', 'rules')),
  summary text not null constraint proposals_summary_length check (char_length(summary) between 1 and 300),
  changes jsonb not null constraint proposals_changes_array check (jsonb_typeof(changes) = 'array' and pg_column_size(changes) < 65536),
  status public.proposal_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index proposals_trip_created on public.proposals (trip_id, created_at desc);

-- Child rows may only point at the caller's own trips.
create function public.owns_trip(p_trip uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.trips t where t.id = p_trip and t.user_id = (select auth.uid())
  );
$$;

create function public.touch_trip()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger trips_touch before update on public.trips
  for each row execute function public.touch_trip();

alter table public.trips enable row level security;
alter table public.trip_days enable row level security;
alter table public.trip_stops enable row level security;
alter table public.proposals enable row level security;

revoke all on table public.trips, public.trip_days, public.trip_stops, public.proposals from anon, authenticated;

grant select, delete on table public.trips to authenticated;
grant insert (id, user_id, city_id, title, start_date, day_count, pace, budget, currency)
  on table public.trips to authenticated;
grant update (title, start_date, currency) on table public.trips to authenticated;

grant select, delete on table public.trip_days to authenticated;
grant insert (trip_id, user_id, day_index, title, title_source, mode, route)
  on table public.trip_days to authenticated;
grant update (title, title_source, mode, route) on table public.trip_days to authenticated;

grant select, delete on table public.trip_stops to authenticated;
grant insert (id, trip_id, user_id, day_index, position, source_key, place, dwell_minutes, price_level, cost_amount)
  on table public.trip_stops to authenticated;
grant update (day_index, position, dwell_minutes, price_level, cost_amount)
  on table public.trip_stops to authenticated;

grant select, delete on table public.proposals to authenticated;
grant insert (trip_id, user_id, request, source, summary, changes) on table public.proposals to authenticated;
grant update (status, decided_at) on table public.proposals to authenticated;

create policy "Trips belong to their owner"
  on public.trips for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Trip days belong to the trip's owner"
  on public.trip_days for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_trip(trip_id));

create policy "Trip stops belong to the trip's owner"
  on public.trip_stops for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_trip(trip_id));

create policy "Proposals belong to the trip's owner"
  on public.proposals for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and public.owns_trip(trip_id));

-- Creates a composed trip, its days and its stops in one transaction, so a failure never leaves a
-- half-made trip. SECURITY INVOKER: the caller's grants and the policies above apply to every row.
create function public.create_trip(p_trip jsonb, p_days jsonb, p_stops jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into public.trips (id, city_id, title, start_date, day_count, pace, budget, currency)
  values (
    new_id,
    (p_trip ->> 'city_id')::integer,
    p_trip ->> 'title',
    (p_trip ->> 'start_date')::date,
    (p_trip ->> 'day_count')::smallint,
    (p_trip ->> 'pace')::public.travel_pace,
    (p_trip ->> 'budget')::public.budget_band,
    p_trip ->> 'currency'
  );

  insert into public.trip_days (trip_id, day_index, title, title_source, mode, route)
  select new_id, (d ->> 'day_index')::smallint, d ->> 'title', d ->> 'title_source',
         (d ->> 'mode')::public.travel_mode, nullif(d -> 'route', 'null'::jsonb)
  from jsonb_array_elements(p_days) as d;

  insert into public.trip_stops (trip_id, day_index, position, source_key, place, dwell_minutes, price_level)
  select new_id, (s ->> 'day_index')::smallint, (s ->> 'position')::smallint, s ->> 'source_key',
         s -> 'place', (s ->> 'dwell_minutes')::smallint, (s ->> 'price_level')::smallint
  from jsonb_array_elements(p_stops) as s;

  return new_id;
end;
$$;

-- Rearranges a trip in one transaction: removes stops, adds stops, then places every remaining stop
-- at its day and position. The layout must list each of the trip's stops exactly once, so a stale
-- client can never lose a stop. SECURITY INVOKER: grants and policies apply.
create function public.arrange_trip(
  p_trip uuid,
  p_layout jsonb,
  p_remove uuid[] default '{}',
  p_add jsonb default '[]'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expected integer;
  listed integer;
begin
  if not public.owns_trip(p_trip) then
    raise exception 'trip not found' using errcode = '42501';
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
  where ts.id = (l ->> 'id')::uuid and ts.trip_id = p_trip;

  -- Touch the trip so lists sort by last change (the trigger sets updated_at).
  update public.trips set title = title where id = p_trip;
end;
$$;

revoke all on function public.create_trip(jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.arrange_trip(uuid, jsonb, uuid[], jsonb) from public, anon;
revoke all on function public.owns_trip(uuid) from public, anon;
grant execute on function public.create_trip(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.arrange_trip(uuid, jsonb, uuid[], jsonb) to authenticated;
grant execute on function public.owns_trip(uuid) to authenticated;
