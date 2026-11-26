import { Button } from "@/components/ui/button";
import { cpa } from "@/lib/ais";
import { formatMeters, haversineMeters } from "@/lib/geo";
import { useHelm, useUnitsKey } from "@/store/helm";

const CLS: Record<string, string> = { A: "Ship (class A)", B: "Small craft (class B)", aton: "Aid to navigation", sart: "Rescue beacon (SART)", base: "Shore station" };

/** The card for a tapped AIS target: who, how fast, and how close it will pass. */
export function AisCard() {
  useUnitsKey();
  const mmsi = useHelm((s) => s.aisCard);
  const t = useHelm((s) => s.aisTargets.find((x) => x.mmsi === s.aisCard) ?? null);
  const boat = useHelm((s) => s.boat);
  const panel = useHelm((s) => s.panel);
  if (!mmsi || panel) return null;
  const close = () => useHelm.setState({ aisCard: null });
  const c = t && boat ? cpa({ lat: boat.lat, lng: boat.lng, sogKn: boat.speedMs * 1.943844, cogDeg: boat.heading ?? NaN }, t) : null;
  const age = t ? Math.round((Date.now() - t.at) / 60_000) : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))+4.4rem)] z-30 flex justify-center px-2">
      <div className="pointer-events-auto w-full max-w-md rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-border)] rp-glass">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-t15 font-semibold">{t?.name || `MMSI ${mmsi}`}</p>
            <p className="text-t13 text-muted-foreground">
              {[t ? CLS[t.cls] : "No longer heard", t?.lengthM ? `${Math.round(t.lengthM)} m long` : "", `MMSI ${mmsi}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button variant="outline" className="h-10 shrink-0" onClick={close}>
            Close
          </Button>
        </div>
        {t ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-t14 tabular-nums">
            <div>
              <dt className="text-t12 text-muted-foreground">Speed and course</dt>
              <dd className="font-semibold">
                {Number.isFinite(t.sogKn) ? `${t.sogKn.toFixed(1)} kn` : "?"}
                {Number.isFinite(t.cogDeg) ? ` · ${Math.round(t.cogDeg)}°` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-t12 text-muted-foreground">Distance</dt>
              <dd className="font-semibold">{boat ? formatMeters(haversineMeters(boat, t)) : "No GPS"}</dd>
            </div>
            {c ? (
              <div className="col-span-2">
                <dt className="text-t12 text-muted-foreground">Closest approach</dt>
                <dd className="font-semibold">
                  {c.tcpaMin < 0 || !Number.isFinite(c.tcpaMin)
                    ? "Moving away or not closing"
                    : `${formatMeters(c.cpaM)} in ${c.tcpaMin < 1 ? "under a minute" : `${Math.round(c.tcpaMin)} min`}`}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <p className="mt-1.5 text-t12 leading-snug text-muted-foreground">
          {age != null ? `Last heard ${age < 1 ? "just now" : `${age} min ago`}. ` : ""}Not every boat has AIS: keep a lookout.
        </p>
      </div>
    </div>
  );
}
