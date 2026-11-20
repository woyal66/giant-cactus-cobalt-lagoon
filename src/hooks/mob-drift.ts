import { useEffect } from "react";
import { driftCone, type DriftInputs } from "@/lib/mob";
import { conditionsAt } from "@/lib/routing/field";
import { loadActivePassage } from "@/lib/routing/passage-store";
import { fetchWeather } from "@/lib/weather";
import { useHelm } from "@/store/helm";

/** Current and wind at the MOB position: saved passage forecast first (offline), then the forecast. */
export async function inputsAt(lat: number, lng: number, at: number): Promise<{ d: DriftInputs; source: string } | null> {
  const saved = await loadActivePassage();
  const field = saved?.fields[0];
  if (field && at >= field.times[0]! && at <= field.times[field.times.length - 1]!) {
    const c = conditionsAt(field, lat, lng, at);
    return { d: { curKn: c.curKn, curDir: c.curDir, windKn: c.windKn, windDir: c.windDir }, source: "saved passage forecast" };
  }
  try {
    const f = await fetchWeather(lat, lng);
    return {
      d: {
        curKn: f.sea?.currentKn ?? 0,
        curDir: f.sea?.currentDir ?? 0,
        windKn: f.now.windKn,
        windDir: f.now.dirDeg,
      },
      source: f.savedAt ? "saved forecast (no signal)" : "forecast",
    };
  } catch {
    return null;
  }
}

/** Keeps the predicted drift of a man overboard up to date (every minute). */
export function useMobDrift() {
  const mob = useHelm((s) => s.mob);
  useEffect(() => {
    if (!mob) return;
    let live = true;
    let inputs: { d: DriftInputs; source: string } | null = null;
    const update = () => {
      const minsSince = (Date.now() - mob.at) / 60_000;
      const d = inputs?.d ?? { curKn: 0, curDir: 0, windKn: 0, windDir: 0 };
      // Predict from the mark's time, so "+5 min" means five minutes after the fall.
      const pts = driftCone(mob, d, [5, 10, 20].map((m) => m)).map((p) => ({ ...p }));
      const now = driftCone(mob, d, [Math.max(0, minsSince)])[0]!;
      useHelm.getState().setMobDrift({
        points: [now, ...pts].sort((a, b) => a.minutes - b.minutes),
        source: inputs ? inputs.source : "no current data: drift unknown",
      });
    };
    void inputsAt(mob.lat, mob.lng, mob.at).then((r) => {
      if (!live) return;
      inputs = r;
      update();
    });
    update();
    const id = window.setInterval(update, 60_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [mob]);
}
