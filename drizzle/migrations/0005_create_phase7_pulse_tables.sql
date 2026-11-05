create type public.pulse_report_type as enum ('scooter_damaged', 'station_elevator_broken', 'high_crowding', 'police_check', 'custom_shortcut', 'surge_pricing');

create table public.community_mobility_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  report_type public.pulse_report_type not null,
  lat double precision not null,
  lng double precision not null,
  note text,
  upvotes_count integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);
grant select, insert on public.community_mobility_reports to anon;
grant select, insert, update on public.community_mobility_reports to authenticated;
grant all on public.community_mobility_reports to service_role;
alter table public.community_mobility_reports enable row level security;
create policy "Anyone can read active reports" on public.community_mobility_reports for select to anon, authenticated using (expires_at > now());
create policy "Anyone can drop a report" on public.community_mobility_reports for insert to anon, authenticated with check (true);
create policy "Authenticated users can upvote" on public.community_mobility_reports for update to authenticated using (expires_at > now()) with check (expires_at > now());

create table public.user_gamification_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp_points integer not null default 0,
  trust_tier text not null default 'Newcomer',
  badges_unlocked text[] not null default '{}',
  updated_at timestamptz not null default now()
);
grant select on public.user_gamification_profiles to authenticated;
grant all on public.user_gamification_profiles to service_role;
alter table public.user_gamification_profiles enable row level security;
create policy "Users read own gamification profile" on public.user_gamification_profiles for select to authenticated using (auth.uid() = user_id);

create table public.curated_discovery_routes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  route_geojson jsonb not null,
  estimated_duration_mins integer not null,
  eco_score numeric not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.curated_discovery_routes to anon, authenticated;
grant all on public.curated_discovery_routes to service_role;
alter table public.curated_discovery_routes enable row level security;
create policy "Discovery routes are public" on public.curated_discovery_routes for select to anon, authenticated using (true);