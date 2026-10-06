import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { ServiceAlert } from "./engine";

/** Current transit service alerts, refreshed every 30 s. Swap the source for a real GTFS-RT feed later without touching the UI. */
export function useServiceAlerts(): ServiceAlert[] {
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () =>
      supabase
        .from("gtfs_rt_service_alerts")
        .select("affected_lines, header_text, delay_minutes, severity_level")
        .then(({ data }) => alive && data && setAlerts(data));
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return alerts;
}
