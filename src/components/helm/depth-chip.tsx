import { DEPTH_LEGEND } from "@/lib/depth";
import { formatDepth } from "@/lib/units";
import { useHelm, useUnitsKey } from "@/store/helm";

/** Key for the seabed overlay, so the colours are never a guess. */
export function DepthChip() {
  useUnitsKey();
  const mode = useHelm((s) => s.depthLayer);
  const tide = useHelm((s) => s.tideNowMsl);
  const draft = useHelm((s) => s.hull.draftM);
  const panel = useHelm((s) => s.panel);
  if (mode === "off" || panel) return null;
  return (
    <div className="pointer-events-none absolute bottom-[calc(max(0.5rem,env(safe-area-inset-bottom))+5.2rem)] right-2 z-30 max-w-[15rem] rounded-lg bg-card/95 px-2.5 py-1.5 text-t13 leading-snug shadow-[var(--shadow-border)]">
      {mode === "shallow" ? (
        <>
          <p>
            <span className="mr-1 inline-block size-2.5 rounded-sm bg-[rgb(230,40,40)]" />
            Under {formatDepth(draft + 0.5)} now
            <span className="ml-2 mr-1 inline-block size-2.5 rounded-sm bg-[rgb(240,170,40)]" />
            within 1 m
          </p>
          <p className="text-muted-foreground">
            Tide {tide == null ? "unknown (mean sea level used)" : `${tide >= 0 ? "+" : "−"}${formatDepth(Math.abs(tide))} on mean`}. Approximate seabed: check with the sounder.
          </p>
        </>
      ) : (
        <>
          <div className="flex gap-1">
            {DEPTH_LEGEND.map((l) => (
              <span key={l.label} className="flex flex-col items-center">
                <span className="h-2.5 w-7 rounded-sm" style={{ background: `rgba(${l.rgba.slice(0, 3).join(",")},${Math.min(1, l.rgba[3] / 160)})` }} />
                <span className="text-t11">{l.label}</span>
              </span>
            ))}
          </div>
          <p className="text-muted-foreground">Water depth now (m), approximate.</p>
        </>
      )}
    </div>
  );
}
