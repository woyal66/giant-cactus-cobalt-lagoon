import { useHelm } from "@/store/helm";

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Radar frame time and loop control, with a warning when a heavy cell is closing. */
export function RadarChip() {
  const on = useHelm((s) => s.radar);
  const info = useHelm((s) => s.radarInfo);
  const panel = useHelm((s) => s.panel);
  if (!on || !info || panel) return null;
  const t = new Date(info.frameAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const ageMin = Math.round((Date.now() - info.latestAt) / 60_000);
  const future = info.frameAt > info.latestAt;
  const cell = info.cell;
  return (
    <div className="pointer-events-none absolute bottom-[calc(max(0.5rem,env(safe-area-inset-bottom))+5.2rem)] left-2 z-30 grid max-w-[16rem] gap-1">
      {cell ? (
        <div className="rounded-lg bg-destructive px-2.5 py-1.5 text-[12px] leading-snug font-semibold text-white shadow-[var(--shadow-border)]">
          Heavy rain {cell.distNm.toFixed(0)} nm {COMPASS[Math.round(cell.bearing / 45) % 8]}, closing
          {cell.etaMin != null ? ` · ~${cell.etaMin} min` : ""}
        </div>
      ) : null}
      <button
        type="button"
        aria-label={info.playing ? "Pause the radar loop" : "Play the radar loop"}
        onClick={() => useHelm.getState().setRadarInfo({ ...info, playing: !info.playing })}
        className="pointer-events-auto justify-self-start rounded-full bg-card/95 px-3 py-1.5 text-[11px] font-semibold tracking-[0.1em] uppercase tabular-nums shadow-[var(--shadow-border)]"
      >
        {info.playing ? "❚❚" : "▶"} Radar {t}
        {future ? " (forecast)" : !info.playing && ageMin > 20 ? ` · ${ageMin} min old` : ""}
      </button>
    </div>
  );
}
