import { createServerFn } from "@tanstack/react-start";

/** Public corridor reliability scores, read server-side (table is not exposed to the browser). */
export const getCorridorReliability = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, number>> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("intercity_corridor_routes")
        .select("corridor_code, realtime_reliability_score");
      return Object.fromEntries(
        (data ?? []).map((d) => [d.corridor_code, Number(d.realtime_reliability_score)]),
      );
    } catch {
      return {};
    }
  },
);
