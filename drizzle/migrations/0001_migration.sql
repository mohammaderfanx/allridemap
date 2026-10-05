DROP POLICY IF EXISTS "Providers are public" ON public.provider_integrations;
REVOKE SELECT ON public.provider_integrations FROM anon, authenticated;