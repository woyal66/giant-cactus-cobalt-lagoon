import { useEffect, useState } from "react";
import { hazardName, hazardsAlong, loadHazards, type Hazard } from "@/lib/hazards";
import { formatMeters } from "@/lib/geo";
import { useHelm, useUnitsKey } from "@/store/helm";

type Hit = { hazard: Hazard; distM: number; lat: number; lng: number };

/** Mapped reefs, drying reef, rocks and cays that a route crosses or passes within 50 m of. */
export function HazardCheck({ points }: { points: Array<{ lat: number; lng: number }> }) {
  useUnitsKey();
  const [hits, setHits] = useState<Hit[] | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setHits(undefined);
    void loadHazards().then((idx) => {
      if (live) setHits(idx ? hazardsAlong(idx, points) : null);
    });
    return () => {
      live = false;
    };
  }, [points]);
  if (hits === undefined || hits === null || points.length < 2) return null;
  if (!hits.length) {
    return <p className="mb-2 text-t13 text-muted-foreground">No mapped reefs, rocks or cays within 50 m of the route.</p>;
  }
  const crossing = hits.filter((h) => h.distM === 0);
  return (
    <div className="mb-2 rounded-md border border-destructive/60 bg-destructive/10 px-2.5 py-2 text-t14">
      <p className="font-semibold text-destructive">
        {crossing.length ? `Route crosses ${crossing.length === 1 ? "a mapped hazard" : `${crossing.length} mapped hazards`}` : "Route passes close to mapped hazards"}
      </p>
      <ul className="mt-1 grid gap-1">
        {hits.slice(0, 6).map((h) => (
          <li key={`${h.lat},${h.lng}`}>
            <button type="button" className="text-left underline" onClick={() => useHelm.getState().setRouteCursor({ lat: h.lat, lng: h.lng })}>
              {h.distM === 0 ? `Over ${hazardName(h.hazard)}` : `${formatMeters(h.distM)} from ${hazardName(h.hazard)}`}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-t13 text-muted-foreground">
        From GBRMPA reef mapping (not every bommie or rock is in it). Tap one to see it on the chart.
      </p>
    </div>
  );
}
