import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildOptions, type TripOption } from "./engine";
import { placeById } from "./geo";

const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
function geohash(lat: number, lng: number, precision = 7): string {
  let latR = [-90, 90], lngR = [-180, 180], bit = 0, ch = 0, even = true, out = "";
  while (out.length < precision) {
    const r = even ? lngR : latR;
    const v = even ? lng : lat;
    const mid = (r[0]! + r[1]!) / 2;
    if (v >= mid) { ch = (ch << 1) | 1; r[0] = mid; } else { ch <<= 1; r[1] = mid; }
    even = !even;
    if (++bit === 5) { out += B32[ch]; bit = 0; ch = 0; }
  }
  return out;
}

/** Trip search with a 60-second shared cache in Lovable Cloud. Falls back to live computation if the cache is unreachable. */
export const searchTrips = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ from: z.string().max(200), to: z.string().max(200), stops: z.array(z.string().max(200)).max(4) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ options: TripOption[]; cached: boolean }> => {
    const o = placeById(data.from);
    const d = placeById(data.to);
    if (!o || !d) return { options: [], cached: false };
    const key = [data.from, ...data.stops, data.to].join(">");
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: hit } = await supabaseAdmin
        .from("route_cache_snapshots")
        .select("options_json")
        .eq("cache_key", key)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (hit) return { options: hit.options_json as unknown as TripOption[], cached: true };
      const options = buildOptions(data.from, data.to, Math.floor(Date.now() / 3000), data.stops);
      await supabaseAdmin.from("route_cache_snapshots").insert({
        cache_key: key,
        origin_geohash: geohash(o.lat, o.lng),
        destination_geohash: geohash(d.lat, d.lng),
        options_json: options as never,
      });
      // housekeeping: drop expired snapshots
      await supabaseAdmin.from("route_cache_snapshots").delete().lt("expires_at", new Date(Date.now() - 300_000).toISOString());
      return { options, cached: false };
    } catch (e) {
      console.error("route cache unavailable", e);
      return { options: buildOptions(data.from, data.to, Math.floor(Date.now() / 3000), data.stops), cached: false };
    }
  });

function fill(tpl: string, v: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => encodeURIComponent(v[k] ?? ""));
}

/** Records a "Continue with" click and returns the provider app link + web fallback built from the stored template. */
export const trackHandoff = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        provider: z.string().max(40),
        olat: z.number().min(-90).max(90),
        olng: z.number().min(-180).max(180),
        dlat: z.number().min(-90).max(90),
        dlng: z.number().min(-180).max(180),
        fare: z.number().min(0).max(10000).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<{ app: string; web: string; status: string } | null> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: p } = await supabaseAdmin
        .from("provider_integrations")
        .select("id, affiliate_tag, deep_link_template, web_fallback_url, status")
        .eq("slug", data.provider)
        .maybeSingle();
      if (!p) return null;
      await supabaseAdmin.from("affiliate_conversions").insert({
        provider_id: p.id,
        origin_lat: data.olat,
        origin_lng: data.olng,
        destination_lat: data.dlat,
        destination_lng: data.dlng,
        estimated_fare_eur: data.fare,
      });
      const vars = { aff: p.affiliate_tag ?? "", olat: String(data.olat), olng: String(data.olng), dlat: String(data.dlat), dlng: String(data.dlng) };
      return {
        app: fill(p.deep_link_template ?? "", vars),
        web: fill(p.web_fallback_url ?? "", vars),
        status: p.status,
      };
    } catch (e) {
      console.error("handoff tracking failed", e);
      return null;
    }
  });
