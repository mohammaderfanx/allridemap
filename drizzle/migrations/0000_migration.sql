CREATE TYPE public.provider_category AS ENUM ('Ride-Hailing','Micro-Mobility','Public-Transit');
CREATE TYPE public.provider_status AS ENUM ('active','degraded','offline');

CREATE TABLE public.provider_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  provider_name text NOT NULL,
  category public.provider_category NOT NULL,
  affiliate_tag text,
  deep_link_template text,
  web_fallback_url text,
  status public.provider_status NOT NULL DEFAULT 'active'
);
GRANT SELECT ON public.provider_integrations TO anon, authenticated;
GRANT ALL ON public.provider_integrations TO service_role;
ALTER TABLE public.provider_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers are public" ON public.provider_integrations FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.route_cache_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key text NOT NULL,
  origin_geohash text NOT NULL,
  destination_geohash text NOT NULL,
  options_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '60 seconds'
);
CREATE INDEX ON public.route_cache_snapshots (origin_geohash, destination_geohash);
CREATE INDEX ON public.route_cache_snapshots (cache_key, expires_at DESC);
GRANT ALL ON public.route_cache_snapshots TO service_role;
ALTER TABLE public.route_cache_snapshots ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.affiliate_conversions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  provider_id uuid NOT NULL REFERENCES public.provider_integrations(id),
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  destination_lat double precision NOT NULL,
  destination_lng double precision NOT NULL,
  estimated_fare_eur numeric,
  clicked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.affiliate_conversions (provider_id, clicked_at DESC);
GRANT ALL ON public.affiliate_conversions TO service_role;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

INSERT INTO public.provider_integrations (slug, provider_name, category, affiliate_tag, deep_link_template, web_fallback_url) VALUES
('uber','Uber','Ride-Hailing','ALLRIDE_AFF_123','uber://?client_id={aff}&action=setPickup&pickup[latitude]={olat}&pickup[longitude]={olng}&dropoff[latitude]={dlat}&dropoff[longitude]={dlng}','https://m.uber.com/ul/?client_id={aff}&action=setPickup&pickup[latitude]={olat}&pickup[longitude]={olng}&dropoff[latitude]={dlat}&dropoff[longitude]={dlng}'),
('bolt','Bolt','Ride-Hailing','ALLRIDE_AFF_123','bolt://action/setPickup?pickup_latitude={olat}&pickup_longitude={olng}&destination_latitude={dlat}&destination_longitude={dlng}','https://bolt.eu/en/cities/stuttgart/'),
('freenow','FreeNow','Ride-Hailing','ALLRIDE_AFF_123','freenow://','https://www.free-now.com/de/'),
('taxi','Taxi Stuttgart','Ride-Hailing',NULL,'tel:+4971119410','https://www.taxi-stuttgart.de/'),
('lime','Lime','Micro-Mobility','ALLRIDE_AFF_123','lime://','https://www.li.me/'),
('tier','Tier','Micro-Mobility','ALLRIDE_AFF_123','tier://','https://www.tier.app/'),
('voi','Voi','Micro-Mobility','ALLRIDE_AFF_123','voiapp://','https://www.voi.com/'),
('dott','Dott','Micro-Mobility','ALLRIDE_AFF_123','dott://','https://ridedott.com/'),
('nextbike','RegioRad','Micro-Mobility',NULL,'nextbike://','https://www.regioradstuttgart.de/'),
('vvs','VVS','Public-Transit',NULL,'https://www.vvs.de/','https://www.vvs.de/');