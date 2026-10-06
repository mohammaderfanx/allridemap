CREATE TYPE public.alert_severity AS ENUM ('info','warning','severe');
CREATE TABLE public.gtfs_rt_service_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id text NOT NULL DEFAULT 'VVS',
  affected_lines text[] NOT NULL DEFAULT '{}',
  header_text text NOT NULL,
  description_text text,
  severity_level public.alert_severity NOT NULL DEFAULT 'info',
  delay_minutes integer NOT NULL DEFAULT 0,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz
);
GRANT SELECT ON public.gtfs_rt_service_alerts TO anon, authenticated;
GRANT ALL ON public.gtfs_rt_service_alerts TO service_role;
ALTER TABLE public.gtfs_rt_service_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Current alerts are public" ON public.gtfs_rt_service_alerts FOR SELECT TO anon, authenticated
  USING (valid_from <= now() AND (valid_to IS NULL OR valid_to > now()));

INSERT INTO public.gtfs_rt_service_alerts (affected_lines, header_text, description_text, severity_level, delay_minutes) VALUES
('{U6}','U6 delayed by 4 minutes','Signal fault near Stadtmitte. Trains running with delays.','warning',4),
('{S1}','S1 delayed by 7 minutes','Technical problem on the main line tunnel.','severe',7),
('{Bus 42}','Bus 42 running a bit late','Heavy traffic around Schlossplatz.','info',2);