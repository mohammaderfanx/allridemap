import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  token_id: z.string().uuid(),
  status: z.enum(["completed", "cancelled"]),
  provider_reference: z.string().max(200).optional(),
  payout_cents: z.number().int().min(0).max(1_000_000).optional(),
});

/**
 * Conversion postbacks from providers (Uber, Bolt, FreeNow…).
 * Body must be signed: header `x-allride-signature` = base64url HMAC-SHA256 of the raw body
 * with AFFILIATE_WEBHOOK_SECRET.
 */
export const Route = createFileRoute("/api/public/webhooks/affiliates/$provider")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const key = process.env["AFFILIATE_WEBHOOK_SECRET"];
        if (!key) return Response.json({ error: "Postbacks not configured" }, { status: 503 });
        const raw = await request.text();
        if (raw.length > 10_000) return Response.json({ error: "Too large" }, { status: 413 });
        const { hmac, safeEqual } = await import("@/lib/mobility/handoff.server");
        const sig = request.headers.get("x-allride-signature") ?? "";
        if (!sig || !safeEqual(sig, hmac(raw, key))) return Response.json({ error: "Invalid signature" }, { status: 401 });

        let parsed;
        try {
          parsed = Body.parse(JSON.parse(raw));
        } catch {
          return Response.json({ error: "Invalid body" }, { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: prov } = await supabaseAdmin.from("provider_integrations").select("id").eq("slug", params.provider).maybeSingle();
        if (!prov) return Response.json({ error: "Unknown provider" }, { status: 404 });

        // Only a handoff that belongs to this provider, was actually opened, and is still pending can convert.
        const { data: row } = await supabaseAdmin
          .from("affiliate_conversions_attribution")
          .update({
            conversion_status: parsed.status,
            converted_at: new Date().toISOString(),
            provider_reference: parsed.provider_reference ?? null,
            postback_payload: parsed,
            ...(parsed.payout_cents !== undefined ? { estimated_payout_cents: parsed.payout_cents } : {}),
          })
          .eq("token_id", parsed.token_id)
          .eq("provider_id", prov.id)
          .eq("conversion_status", "initiated")
          .not("used_at", "is", null)
          .select("token_id")
          .maybeSingle();
        if (!row) return Response.json({ error: "No matching pending handoff" }, { status: 409 });
        return Response.json({ ok: true });
      },
    },
  },
});
