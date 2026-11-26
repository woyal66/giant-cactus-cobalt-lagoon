import { useHelm } from "@/store/helm";

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Radar frame time and loop control, with a warning when a heavy cell is closing. */
export function RadarChip() {
  const on = useHelm((s) => s.radar);
  const info = useHelm((s) => s.radarInfo);
  const panel = useHelm((s) => s.panel);
  const cell = info?.cell;
  if (!on || !cell || panel) return null;
  // Only the squall warning: the radar picture itself is in Weather → Rain & thunder.
  return (
    <div className="pointer-events-none absolute bottom-[calc(max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))+5.2rem)] left-2 z-30 grid max-w-[16rem] gap-1">
      <button
        type="button"
        onClick={() => {
          const s = useHelm.getState();
          s.setWxMap({ wxMapLayer: "rain", wxLiveAt: Date.now(), wxMapPlaying: false });
        }}
        className="pointer-events-auto rounded-lg bg-destructive px-2.5 py-1.5 text-left text-t14 leading-snug font-semibold text-white shadow-[var(--shadow-border)]"
      >
        Heavy rain {cell.distNm.toFixed(0)} nm {COMPASS[Math.round(cell.bearing / 45) % 8]}, closing
        {cell.etaMin != null ? ` · ~${cell.etaMin} min` : ""}
        <span className="block text-t12 font-normal">Tap to see the radar</span>
      </button>
    </div>
  );
}
