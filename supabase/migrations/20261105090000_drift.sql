-- Drift: what travellers save from their decks, cached daily decks, and per-user AI usage.
-- Place details are stored per user (a snapshot in each row), so no shared, writable cache exists
-- and the app never needs an admin key.

create type public.save_kind as enum ('destination', 'activity');

create table public.saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind public.save_kind not null,
  -- Where the card came from: 'geonames:<id>' for destinations; 'osm:<type>/<id>' or
  -- 'wikipedia:<page id>' for places.
  source_key text not null constraint saves_source_key_format check (source_key ~ '^(geonames:[0-9]+|osm:(node|way|relation)/[0-9]+|wikipedia:[0-9]+)$'),
  -- The destination a card belongs to, so saved places group under their city.
  city_id integer not null references public.cities (geoname_id) on delete restrict,
  verdict public.dna_reaction not null,
  -- Card details at the time of saving; validated by the app's schema before every write.
  snapshot jsonb not null constraint saves_snapshot_object check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) < 16384),
  created_at timestamptz not null default now(),
  unique (user_id, source_key)
);
create index saves_user_city on public.saves (user_id, city_id);

alter table public.saves enable row level security;
revoke all on table public.saves from anon, authenticated;
grant select, delete on table public.saves to authenticated;
-- user_id is re-sent by upserts; the policies pin it to the caller.
grant insert (user_id, kind, source_key, city_id, verdict, snapshot),
      update (user_id, kind, source_key, city_id, verdict, snapshot)
  on table public.saves to authenticated;

create policy "Saves belong to their owner"
  on public.saves for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- One cached deck per traveller, per deck (e.g. 'destinations', 'activities:2267057'), per day.
create table public.drift_decks (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  deck_key text not null constraint drift_decks_key_format check (deck_key ~ '^(destinations|activities:[0-9]+)$'),
  built_on date not null default current_date,
  source text not null constraint drift_decks_source_known check (source in ('compass', 'fallback')),
  cards jsonb not null constraint drift_decks_cards_array check (jsonb_typeof(cards) = 'array' and pg_column_size(cards) < 262144),
  created_at timestamptz not null default now(),
  primary key (user_id, deck_key)
);

alter table public.drift_decks enable row level security;
revoke all on table public.drift_decks from anon, authenticated;
grant select, delete on table public.drift_decks to authenticated;
grant insert (user_id, deck_key, built_on, source, cards),
      update (user_id, deck_key, built_on, source, cards)
  on table public.drift_decks to authenticated;

create policy "Decks belong to their owner"
  on public.drift_decks for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- AI calls per traveller per day. Written only through consume_ai_quota(), never directly.
create table public.ai_usage (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null default current_date,
  calls integer not null default 0 constraint ai_usage_calls_non_negative check (calls >= 0),
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
revoke all on table public.ai_usage from anon, authenticated;
grant select on table public.ai_usage to authenticated;
create policy "AI usage is readable by its owner"
  on public.ai_usage for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Atomically records one AI call for the caller and says whether it fits today's limit. A call over
-- the limit is not recorded, so the counter never runs past it. SECURITY DEFINER because travellers
-- have no write access to ai_usage; it only ever touches the caller's own row.
create function public.consume_ai_quota(daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  used integer;
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if daily_limit is null or daily_limit < 0 then
    raise exception 'Invalid daily limit' using errcode = '22023';
  end if;

  insert into public.ai_usage (user_id, day, calls)
  values (caller, current_date, 1)
  on conflict (user_id, day) do update
    set calls = public.ai_usage.calls + 1
    where public.ai_usage.calls < daily_limit
  returning calls into used;

  return used is not null and used <= daily_limit;
end;
$$;
revoke all on function public.consume_ai_quota(integer) from public, anon;
grant execute on function public.consume_ai_quota(integer) to authenticated;
