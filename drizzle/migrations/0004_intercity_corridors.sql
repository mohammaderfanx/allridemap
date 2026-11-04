CREATE TYPE public.intercity_mode AS ENUM ('high_speed_rail','aviation','evtol','intercity_bus');
CREATE TABLE public.intercity_corridor_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corridor_code text NOT NULL UNIQUE,
  origin_hub_code text NOT NULL,
  destination_hub_code text NOT NULL,
  transport_mode public.intercity_mode NOT NULL,
  provider_code text NOT NULL,
  realtime_reliability_score numeric NOT NULL DEFAULT 0.8 CHECK (realtime_reliability_score BETWEEN 0 AND 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.intercity_corridor_routes TO anon, authenticated;
GRANT ALL ON public.intercity_corridor_routes TO service_role;
ALTER TABLE public.intercity_corridor_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Corridor reliability is public" ON public.intercity_corridor_routes FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.intercity_corridor_routes (corridor_code, origin_hub_code, destination_hub_code, transport_mode, provider_code, realtime_reliability_score) VALUES
('ice-muc','str-hbf','muc-hbf','high_speed_rail','DB',0.69),
('bus-muc','str-zob','muc-hbf','intercity_bus','FlixBus',0.83),
('evtol-muc','str-vtp','muc-vtp','evtol','Volocopter',0.9),
('ice-fra','str-hbf','fra-hbf','high_speed_rail','DB',0.66),
('ice-ber','str-hbf','ber-hbf','high_speed_rail','DB',0.62),
('air-ber','str-air','ber-air','aviation','Eurowings',0.78),
('tgv-par','str-hbf','par-est','high_speed_rail','SNCF',0.81),
('ic-zrh','str-hbf','zrh-hb','high_speed_rail','SBB',0.88),
('air-lhr','str-air','lhr-air','aviation','British Airways',0.74),
('air-ist','str-air','ist-air','aviation','Turkish Airlines',0.76);