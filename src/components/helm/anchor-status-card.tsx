import { useEffect, useState } from "react";
import { Anchor } from "lucide-react";
import { useWx } from "@/hooks/weather";
import { formatMeters, haversineMeters } from "@/lib/geo";
import { windCardinal } from "@/lib/weather";
import { useHelm, useUnitsKey } from "@/store/helm";

function since(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(min / 60);
  return h ? `${h} h ${min % 60} min` : `${min} min`;
}

function clock(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * At anchor, the one card that answers "am I OK?": how far the boat is from the hook against
 * the circle, how long the watch has run, the wind now and the next tide. Tap for the anchor
 * sheet. Shown only while the watch runs and nothing else is open.
 */
export function AnchorStatusCard() {
  useUnitsKey();
  const anchor = useHelm((s) => (s.anchor?.radiusLocked ? s.anchor : null));
  const boat = useHelm((s) => s.boat);
  const panel = useHelm((s) => s.panel);
  const wxMap = useHelm((s) => s.wxMapLayer !== "off");
  const tapMode = useHelm((s) => s.tapMode);
  const drawMode = useHelm((s) => s.drawMode);
  const alarm = useHelm((s) => s.alarmOn);
  const gpsLost = useHelm((s) => s.gpsLost);
  const wx = useWx();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  if (!anchor || panel || wxMap || tapMode !== "none" || drawMode !== "idle") return null;

  const fenced = Boolean(anchor.fence && anchor.fence.length >= 3);
  const dist = boat ? haversineMeters(boat, anchor) : null;
  const frac = dist != null ? Math.min(1, dist / Math.max(1, anchor.radiusM)) : 0;
  const fresh = boat ? now - boat.at < 60_000 && boat.source !== "placed" : false;
  const breach = alarm || gpsLost;
  const w = wx.data?.now;
  const nextTide = wx.data?.sea?.tideTurns?.find((t) => t.at > now);

  return (
    <button
      type="button"
      onClick={() => useHelm.getState().setPanel("anchor")}
      aria-label="Anchor watch. Opens the anchor sheet"
      className={`pointer-events-auto absolute inset-x-2 bottom-[calc(max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))+4.4rem)] z-20 mx-auto max-w-lg rounded-xl border px-3 py-2 text-left shadow-[var(--shadow-border)] rp-glass ${
        breach ? "border-destructive bg-destructive text-white" : "border-primary/60 bg-card/95 text-foreground"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-t15 font-semibold">
          <Anchor className="size-4" aria-hidden />
          {breach ? (gpsLost ? "Alarm: GPS lost" : "Alarm: dragging") : "Watching the anchor"}
        </span>
        <span className={`text-t13 ${breach ? "text-white/90" : "text-muted-foreground"}`}>{since(now - anchor.droppedAt)}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/15" aria-hidden>
          <div
            className={`h-full rounded-full ${breach ? "bg-white" : frac > 0.85 ? "bg-amber-400" : "bg-primary"}`}
            style={{ width: `${Math.max(3, frac * 100)}%` }}
          />
        </div>
        <span className="shrink-0 font-display text-t15 font-semibold tabular-nums">
          {dist != null ? formatMeters(dist) : "—"}
          <span className={`text-t13 font-medium ${breach ? "text-white/90" : "text-muted-foreground"}`}>
            {fenced ? " · barrier" : ` of ${formatMeters(anchor.radiusM)}`}
          </span>
        </span>
      </div>
      <p className={`mt-1 text-t13 leading-snug ${breach ? "text-white/90" : "text-muted-foreground"}`}>
        {!fresh ? "No new GPS fix · " : ""}
        {w ? `Wind ${Math.round(w.windKn)} kn ${windCardinal(w.dirDeg)}${w.gustKn ? `, gusts ${Math.round(w.gustKn)}` : ""}` : "Wind not loaded"}
        {nextTide ? ` · ${nextTide.kind === "high" ? "High" : "Low"} tide ${clock(nextTide.at)}` : ""}
      </p>
    </button>
  );
}
