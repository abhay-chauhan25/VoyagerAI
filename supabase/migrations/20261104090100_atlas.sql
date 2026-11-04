-- Atlas: a reference list of cities (GeoNames) and the places each traveller has been.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Read-only reference data, loaded by the seed (npm run data:cities). Nobody writes to it from the app.
create table public.cities (
  geoname_id integer primary key,
  name text not null,
  ascii_name text not null,
  country_code char(2) not null constraint cities_country_format check (country_code ~ '^[A-Z]{2}$'),
  region text,
  latitude double precision not null constraint cities_latitude_range check (latitude between -90 and 90),
  longitude double precision not null constraint cities_longitude_range check (longitude between -180 and 180),
  population integer not null default 0,
  timezone text
);

create index cities_ascii_name_trgm on public.cities using gin (lower(ascii_name) extensions.gin_trgm_ops);
create index cities_country_code on public.cities (country_code);

alter table public.cities enable row level security;
revoke all on table public.cities from anon, authenticated;
grant select on table public.cities to anon, authenticated;
create policy "Cities are public reference data"
  on public.cities for select
  to anon, authenticated
  using (true);

-- Prefix matches first, then fuzzy matches; bigger places win ties. Accents in the query are ignored.
create function public.search_cities(query text, max_results integer default 8)
returns setof public.cities
language sql
stable
set search_path = ''
as $$
  with q as (
    select lower(extensions.unaccent(btrim(query))) as term
  )
  select c.*
  from public.cities c, q
  where char_length(q.term) >= 2
    and (lower(c.ascii_name) like q.term || '%' or extensions.similarity(lower(c.ascii_name), q.term) > 0.4)
  order by (lower(c.ascii_name) like q.term || '%') desc,
           extensions.similarity(lower(c.ascii_name), q.term) desc,
           c.population desc
  limit least(greatest(max_results, 1), 20);
$$;
grant execute on function public.search_cities(text, integer) to anon, authenticated;

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  country_code char(2) not null constraint visits_country_format check (country_code ~ '^[A-Z]{2}$'),
  city_id integer references public.cities (geoname_id) on delete restrict,
  visited_year smallint constraint visits_year_range check (visited_year between 1900 and 2100),
  created_at timestamptz not null default now()
);

-- One entry per city, and one country-level entry per country, per traveller.
create unique index visits_user_city_key on public.visits (user_id, city_id) where city_id is not null;
create unique index visits_user_country_only_key on public.visits (user_id, country_code) where city_id is null;
create index visits_user_id on public.visits (user_id);

-- A city's country always wins, so a visit can never claim a city in the wrong country.
create function public.visits_sync_country()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  city_country char(2);
begin
  if new.city_id is not null then
    select country_code into city_country from public.cities where geoname_id = new.city_id;
    if city_country is null then
      raise exception 'Unknown city %', new.city_id using errcode = '23503';
    end if;
    new.country_code := city_country;
  end if;
  return new;
end;
$$;

create trigger visits_sync_country
  before insert on public.visits
  for each row execute function public.visits_sync_country();

alter table public.visits enable row level security;
revoke all on table public.visits from anon, authenticated;
grant select on table public.visits to anon, authenticated;
grant insert (country_code, city_id, visited_year), delete on table public.visits to authenticated;

create policy "Visits are readable by their owner or on a public profile"
  on public.visits for select
  to authenticated, anon
  using ((select auth.uid()) = user_id or public.profile_is_public(user_id));
create policy "Visits are added by their owner"
  on public.visits for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Visits are removed by their owner"
  on public.visits for delete
  to authenticated
  using ((select auth.uid()) = user_id);
