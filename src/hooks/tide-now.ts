import { useEffect } from "react";
import { useWx } from "@/hooks/weather";
import { tideAt } from "@/lib/tides";
import { useHelm } from "@/store/helm";

/**
 * Tide height above mean sea level now, for the shallow-water overlay. Model tides are already
 * about mean sea level; BOM station tides are above the chart datum (LAT), so their average is
 * taken off. Updated every 5 minutes.
 */
export function useTideNow() {
  const wx = useWx();
  const sea = wx.data?.sea;
  useEffect(() => {
    const hours = sea?.tideHours ?? [];
    const set = useHelm.getState().setTideNowMsl;
    if (hours.length < 2) {
      set(null);
      return;
    }
    const station = sea?.tideOrigin?.kind === "station";
    const mean = station ? hours.reduce((a, h) => a + h.m, 0) / hours.length : 0;
    const update = () => {
      const v = tideAt(hours, Date.now());
      set(v == null ? null : Math.round((v - mean) * 10) / 10);
    };
    update();
    const id = window.setInterval(update, 5 * 60_000);
    return () => window.clearInterval(id);
  }, [sea]);
}
