CREATE TYPE public.conversion_status AS ENUM ('initiated','completed','cancelled');
CREATE TABLE public.affiliate_conversions_attribution (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signed_payload text NOT NULL,
  provider_id uuid NOT NULL REFERENCES public.provider_integrations(id),
  estimated_payout_cents integer NOT NULL DEFAULT 0,
  conversion_status public.conversion_status NOT NULL DEFAULT 'initiated',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  used_at timestamptz,
  converted_at timestamptz,
  provider_reference text,
  postback_payload jsonb
);
CREATE INDEX ON public.affiliate_conversions_attribution (provider_id, created_at DESC);
GRANT ALL ON public.affiliate_conversions_attribution TO service_role;
ALTER TABLE public.affiliate_conversions_attribution ENABLE ROW LEVEL SECURITY;