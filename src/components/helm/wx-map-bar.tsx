import { useEffect } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WIND_SCALE_STEPS } from "@/lib/weather";
import { WX_MAP_LAYERS } from "@/lib/wx-map";
import { useHelm } from "@/store/helm";

const H = 3_600_000;

function when(at: number): string {
  const d = new Date(at);
  return d.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}

const LEGEND: Record<string, Array<{ c: string; t: string }>> = {
  waves: [
    { c: "rgb(48,146,224)", t: "0.5 m" },
    { c: "rgb(90,130,200)", t: "1" },
    { c: "rgb(140,110,160)", t: "2" },
    { c: "rgb(240,60,80)", t: "4 m+" },
  ],
  rain: [
    { c: "rgba(56,152,236,0.35)", t: "light" },
    { c: "rgba(56,152,236,0.6)", t: "moderate" },
    { c: "rgba(56,152,236,0.8)", t: "heavy" },
  ],
  storm: [
    { c: "rgba(240,190,40,0.7)", t: "possible" },
    { c: "rgba(240,120,30,0.8)", t: "likely" },
    { c: "rgba(220,40,40,0.9)", t: "severe" },
  ],
};

/** Weather on the chart: layer choice, arrows or particles, time slider with play. */
export function WxMapBar() {
  const layer = useHelm((s) => s.wxMapLayer);
  const style = useHelm((s) => s.wxMapStyle);
  const at = useHelm((s) => s.wxMapAt);
  const info = useHelm((s) => s.wxMapInfo);
  const panel = useHelm((s) => s.panel);
  const set = useHelm((s) => s.setWxMap);
  const playing = useHelm((s) => s.wxMapPlaying);
  const times = info?.times ?? [];
  const now = Date.now();
  const first = times.find((t) => t >= now - H) ?? times[0] ?? now;
  const last = Math.min(times[times.length - 1] ?? now, first + 72 * H);
  const hours = Math.max(0, Math.round((last - first) / H));
  const step = Math.max(0, Math.min(hours, Math.round((at - first) / H)));

  useEffect(() => {
    if (!playing || !hours) return;
    const id = window.setInterval(() => {
      const s = useHelm.getState();
      const cur = Math.round((s.wxMapAt - first) / H);
      s.setWxMap({ wxMapAt: first + ((cur + 1) % (hours + 1)) * H });
    }, 900);
    return () => window.clearInterval(id);
  }, [playing, hours, first]);

  if (layer === "off" || panel) return null;
  const vectors = layer === "wind" || layer === "current";
  const legend =
    layer === "wind" || layer === "gust"
      ? WIND_SCALE_STEPS.map((x, i) => ({ c: x.bg, t: i < WIND_SCALE_STEPS.length - 1 ? `${x.upTo}` : "" }))
      : layer === "current"
        ? [{ c: "#c4b5fd", t: "current (kn)" }]
        : layer === "pressure"
          ? [{ c: "#ffffff", t: "isobars every 2 hPa · H high, L low" }]
          : (LEGEND[layer] ?? []);

  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-[calc(max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))+5.2rem)] z-30 mx-auto max-w-lg rounded-xl border border-border bg-card/97 p-2 shadow-[var(--shadow-border)] rp-glass">
      <div className="flex items-center justify-between gap-2">
        <p className="text-t15 font-semibold tabular-nums">{when(first + step * H)}</p>
        <Button variant="outline" className="h-9 px-3" onClick={() => set({ wxMapLayer: "off", wxMapPlaying: false })}>
          Close
        </Button>
      </div>
      <div className="mt-1.5 flex gap-1 overflow-x-auto pb-0.5" role="radiogroup" aria-label="Weather layer">
        {WX_MAP_LAYERS.map((l) => (
          <Button
            key={l.id}
            role="radio"
            aria-checked={layer === l.id}
            variant={layer === l.id ? "default" : "outline"}
            className="h-10 shrink-0 px-3"
            onClick={() => set({ wxMapLayer: l.id })}
          >
            {l.label}
          </Button>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <Button
          variant="outline"
          className="h-11 w-11 shrink-0 p-0"
          aria-label={playing ? "Pause" : "Play the next 3 days"}
          disabled={!hours}
          onClick={() => set({ wxMapPlaying: !playing })}
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </Button>
        <input
          type="range"
          min={0}
          max={hours}
          step={1}
          value={step}
          disabled={!hours}
          aria-label="Forecast time"
          onChange={(e) => set({ wxMapAt: first + Number(e.target.value) * H, wxMapPlaying: false })}
          className="h-11 min-w-0 flex-1 accent-[var(--color-primary)]"
        />
        {vectors ? (
          <Button
            variant="outline"
            className="h-11 shrink-0 px-2.5"
            onClick={() => set({ wxMapStyle: style === "arrows" ? "particles" : "arrows" })}
          >
            {style === "arrows" ? "Moving" : "Arrows"}
          </Button>
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-t12 text-muted-foreground">
        {legend.map((x) => (
          <span key={x.c + x.t} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: x.c }} />
            {x.t}
          </span>
        ))}
        <span className="ml-auto">
          {info?.source === "loading"
            ? "Loading…"
            : info?.source === "saved"
              ? "Saved forecast (no signal)"
              : info?.source === "passage"
                ? "Passage forecast (offline)"
                : info?.source === "none"
                  ? "No forecast for this area"
                  : "ECMWF"}
        </span>
      </div>
    </div>
  );
}
