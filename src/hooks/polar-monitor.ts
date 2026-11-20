import { useEffect } from "react";
import { inputsAt } from "@/hooks/mob-drift";
import type { DriftInputs } from "@/lib/mob";
import { addSample, isCleanSample, throughWater, type Sample } from "@/lib/routing/learned";
import { sailSpeed } from "@/lib/routing/polar";
import { haversineMeters } from "@/lib/geo";
import { boatPerfOf, useHelm } from "@/store/helm";

const KN = 1.94384;
const SAMPLE_MS = 30_000;
const WIND_REFRESH_MS = 30 * 60_000;

/**
 * Speed versus polar while underway: GPS speed through the water (current removed) against
 * the built-in polar for the forecast wind, and learning from clean samples.
 */
export function usePolarMonitor() {
  useEffect(() => {
    let wind: { d: DriftInputs; source: string; at: number; lat: number; lng: number } | null = null;
    let fetching = false;
    const hist: { at: number; cog: number; sogKn: number }[] = [];
    let ratioAvg: number | null = null;
    let lastSample = 0;

    const refreshWind = (lat: number, lng: number) => {
      if (fetching) return;
      const stale = !wind || Date.now() - wind.at > WIND_REFRESH_MS || haversineMeters(wind, { lat, lng }) > 10_000;
      if (!stale) return;
      fetching = true;
      void inputsAt(lat, lng, Date.now())
        .then((r) => {
          if (r) wind = { ...r, at: Date.now(), lat, lng };
        })
        .finally(() => {
          fetching = false;
        });
    };

    const onFix = () => {
      const s = useHelm.getState();
      const b = s.boat;
      const set = s.setPerfLive;
      if (!b || b.source !== "gps" || b.heading == null || b.speedMs * KN < 1.5 || s.routePrefs.boatType === "motor") {
        if (s.perfLive) set(null);
        ratioAvg = null;
        return;
      }
      const sogKn = b.speedMs * KN;
      hist.push({ at: b.at, cog: b.heading, sogKn });
      while (hist.length && b.at - hist[0].at > 60_000) hist.shift();
      refreshWind(b.lat, b.lng);
      if (!wind) return;
      const { stwKn, headingDeg } = throughWater(sogKn, b.heading, wind.d.curKn, wind.d.curDir);
      const twaDeg = Math.abs(((wind.d.windDir - headingDeg + 540) % 360) - 180);
      const base = { ...boatPerfOf(s.routePrefs, s.hull.loaM) };
      delete base.learned;
      const polarKn = sailSpeed(base, wind.d.windKn, twaDeg);
      if (polarKn < 0.5) {
        if (s.perfLive) set(null);
        return;
      }
      const r = stwKn / polarKn;
      ratioAvg = ratioAvg == null ? r : ratioAvg + (r - ratioAvg) * 0.1;
      const first = hist[0];
      const turn = Math.abs(((b.heading - first.cog + 540) % 360) - 180);
      const sample: Sample = {
        twsKn: wind.d.windKn,
        twaDeg,
        stwKn,
        polarKn,
        engineOn: s.routePrefs.engineOn,
        turnDeg: turn,
        speedChangeKn: sogKn - first.sogKn,
      };
      const clean = b.at - first.at > 45_000 && isCleanSample(sample);
      set({
        pct: Math.round(ratioAvg * 100),
        stwKn,
        polarKn,
        twsKn: wind.d.windKn,
        twaDeg,
        source: wind.source,
        learning: clean,
      });
      if (clean && b.at - lastSample >= SAMPLE_MS) {
        lastSample = b.at;
        s.setRoutePrefs({ learned: addSample(s.routePrefs.learned, sample) });
      }
    };

    let lastAt = 0;
    return useHelm.subscribe((st) => {
      if (st.boat && st.boat.at !== lastAt) {
        lastAt = st.boat.at;
        onFix();
      }
    });
  }, []);
}
