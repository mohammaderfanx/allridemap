DROP POLICY IF EXISTS "Corridor reliability is public" ON public.intercity_corridor_routes;
REVOKE SELECT ON public.intercity_corridor_routes FROM anon, authenticated;
GRANT SELECT ON public.intercity_corridor_routes TO service_role;

DROP POLICY IF EXISTS "Anyone can drop a report" ON public.community_mobility_reports;
REVOKE INSERT ON public.community_mobility_reports FROM anon;
CREATE POLICY "Signed-in users can drop their own report" ON public.community_mobility_reports
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND upvotes_count = 0
  AND lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180
  AND (note IS NULL OR char_length(note) <= 280)
);