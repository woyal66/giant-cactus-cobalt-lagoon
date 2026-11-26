import { useEffect, useMemo } from "react";
import { CloudLightning, CloudRain, Gauge, Navigation, Pause, Play, Waves, Wind, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDepth } from "@/lib/units";
import { compassPoint } from "@/lib/routing/explain";
import {
  CAPE_RAMP,
  CURRENT_RAMP,
  RAIN_RAMP,
  WAVE_RAMP,
  WIND_RAMP,
  WX_MAP_LAYERS,
  layerIndex,
  layerMax,
  probeAt,
  rampGradient,
  type Ramp,
  type WxMapLayer,
} from "@/lib/wx-map";
import { useViewField } from "@/lib/wx-view";
import { ROUTE_MODELS } from "@/lib/routing/fetch-field";
import { useHelm, useUnitsKey } from "@/store/helm";

const H = 3_600_000;

const ICON: Record<WxMapLayer, typeof Wind> = {
  wind: Wind,
  gust: Zap,
  current: Navigation,
  waves: Waves,
  pressure: Gauge,
  rain: CloudRain,
  storm: CloudLightning,
};

/** Legend: colour ramp and the numbers shown under it. */
const LEGEND: Partial<Record<WxMapLayer, { ramp: Ramp; ticks: number[]; unit: string }>> = {
  wind: { ramp: WIND_RAMP, ticks: [0, 10, 20, 30, 40], unit: "kn" },
  gust: { ramp: WIND_RAMP, ticks: [0, 10, 20, 30, 40], unit: "kn" },
  current: { ramp: CURRENT_RAMP, ticks: [0, 1, 2, 3], unit: "kn" },
  waves: { ramp: WAVE_RAMP, ticks: [0, 1, 2, 4, 6], unit: "m" },
  rain: { ramp: RAIN_RAMP, ticks: [0.1, 3, 6, 12], unit: "mm/h" },
  storm: { ramp: CAPE_RAMP, ticks: [300, 2000, 3500], unit: "storm energy" },
};

function when(at: number): string {
  const d = new Date(at);
  return d.toLocaleString([], { weekday: "short", hour: "numeric" });
}

/**
 * Weather on the chart, Windy-style: the bar replaces the dock at the bottom of the screen.
 * Layer buttons, a timeline with day marks and play, and a colour legend. Tap the chart for
 * the forecast at a spot.
 */
export function WxMapBar() {
  useUnitsKey();
  const layer = useHelm((s) => s.wxMapLayer);
  const style = useHelm((s) => s.wxMapStyle);
  const at = useHelm((s) => s.wxMapAt);
  const info = useHelm((s) => s.wxMapInfo);
  const panel = useHelm((s) => s.panel);
  const set = useHelm((s) => s.setWxMap);
  const playing = useHelm((s) => s.wxMapPlaying);
  const modelId = useHelm((s) => s.wxMapModel);
  const field = useViewField();
  const times = info?.times ?? [];
  const now = Date.now();
  const first = times.find((t) => t >= now - H) ?? times[0] ?? now;
  const last = Math.min(times[times.length - 1] ?? now, first + 72 * H);
  const hours = Math.max(0, Math.round((last - first) / H));
  const step = Math.max(0, Math.min(hours, Math.round((at - first) / H)));
  const shown = first + step * H;

  useEffect(() => {
    if (!playing || !hours) return;
    const id = window.setInterval(() => {
      const s = useHelm.getState();
      const cur = Math.round((s.wxMapAt - first) / H);
      s.setWxMap({ wxMapAt: first + ((cur + 1) % (hours + 1)) * H });
    }, 900);
    return () => window.clearInterval(id);
  }, [playing, hours, first]);

  // Midnights on the timeline, for day labels.
  const days = useMemo(() => {
    const out: Array<{ pct: number; label: string }> = [];
    if (!hours) return out;
    const d = new Date(first);
    d.setHours(24, 0, 0, 0);
    for (let t = d.getTime(); t < last; t += 24 * H) {
      out.push({ pct: ((t - first) / (last - first)) * 100, label: new Date(t).toLocaleDateString([], { weekday: "short" }) });
    }
    return out;
  }, [first, last, hours]);

  // Say so when a layer has nothing to show at this hour (no rain, no storms).
  const empty = useMemo(() => {
    if (!field || layer === "off") return null;
    const t = layerIndex(field, shown);
    if (layer === "rain") return layerMax(field.precipMm?.[t]) < 0.1 ? "No rain in view at this hour." : null;
    if (layer === "storm") return layerMax(field.capeJkg?.[t]) < 300 ? "No storm risk in view at this hour." : null;
    if (layer === "waves" || layer === "current") {
      return Number.isFinite(layerMax((layer === "waves" ? field.waveM : field.curKn)[t])) ? null : "No sea data for this area (inland or very close inshore).";
    }
    return null;
  }, [field, layer, shown]);

  if (layer === "off" || panel) return null;
  const motion = layer === "wind" || layer === "gust" || layer === "current" || layer === "waves";
  const marine = layer === "waves" || layer === "current";
  const modelLabel = ROUTE_MODELS.find((m) => m.id === modelId)?.label ?? "ECMWF";
  const legend = LEGEND[layer];
  const source =
    info?.source === "loading"
      ? "Loading…"
      : info?.source === "saved"
        ? "Saved forecast (no signal)"
        : info?.source === "passage"
          ? "Passage forecast (offline)"
          : info?.source === "kept"
            ? "Couldn't update for this area: showing the last forecast"
          : info?.source === "none"
            ? "No forecast for this area"
            : marine
              ? "Open-Meteo marine model (same for every weather model)"
              : `${modelLabel} model`;

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto max-w-2xl rounded-t-2xl border border-b-0 border-border bg-card/97 px-2 pt-2 pb-[max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))] shadow-[var(--shadow-border)] rp-glass">
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5" role="radiogroup" aria-label="Weather layer">
          {WX_MAP_LAYERS.map((l) => {
            const Icon = ICON[l.id];
            const on = layer === l.id;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ wxMapLayer: l.id })}
                className={`flex h-12 min-w-[3.6rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-t12 font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}
              >
                <Icon className="size-4" aria-hidden />
                {l.label}
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 gap-1">
          <Button variant="outline" className="h-12 px-2" aria-label="Forecast here, as a graph" onClick={() => {
            set({ wxMapLayer: "off", wxMapPlaying: false, wxProbe: null });
            useHelm.getState().setPanel("weather");
          }}>
            Forecast
          </Button>
          <Button variant="outline" className="h-12 px-2.5" aria-label="Close the weather map" onClick={() => set({ wxMapLayer: "off", wxMapPlaying: false, wxProbe: null })}>
            Done
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="outline"
          className="h-11 w-11 shrink-0 p-0"
          aria-label={playing ? "Pause" : "Play the next 3 days"}
          disabled={!hours}
          onClick={() => set({ wxMapPlaying: !playing })}
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </Button>
        <div className="relative min-w-0 flex-1">
          <div className="mb-0.5 flex items-baseline justify-between">
            <span className="text-t15 font-semibold tabular-nums">{when(shown)}</span>
            {step !== Math.max(0, Math.round((now - first) / H)) ? (
              <button type="button" className="text-t13 text-primary underline" onClick={() => set({ wxMapAt: now, wxMapPlaying: false })}>
                Now
              </button>
            ) : (
              <span className="text-t13 text-muted-foreground">now</span>
            )}
          </div>
          <input
            type="range"
            min={0}
            max={hours}
            step={1}
            value={step}
            disabled={!hours}
            aria-label="Forecast time"
            onChange={(e) => set({ wxMapAt: first + Number(e.target.value) * H, wxMapPlaying: false })}
            className="h-8 w-full accent-[var(--color-primary)]"
          />
          <div className="relative h-4 text-t11 text-muted-foreground">
            {days.map((d) => (
              <span key={d.pct} className="absolute -translate-x-1/2 border-l border-border pl-1" style={{ left: `${d.pct}%` }}>
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-1 flex items-center gap-2">
        {legend ? (
          <div className="min-w-0 flex-1">
            <div className="h-2.5 rounded-full" style={{ background: rampGradient(legend.ramp) }} />
            <div className="relative h-4 text-t11 text-muted-foreground tabular-nums">
              {legend.ticks.map((v) => {
                const lo = legend.ramp[0]![0];
                const hi = legend.ramp[legend.ramp.length - 1]![0];
                const pct = Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
                return (
                  <span key={v} className="absolute -translate-x-1/2" style={{ left: `${Math.max(4, Math.min(96, pct))}%` }}>
                    {layer === "waves" ? formatDepth(v).replace(/\s*[a-z]+$/i, "").replace(/\.0$/, "") : v}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="min-w-0 flex-1 text-t12 text-muted-foreground">Isobars (hPa) · H high, L low · close lines = strong wind</p>
        )}
        {legend ? (
          <span className="shrink-0 text-t12 text-muted-foreground">{layer === "waves" ? formatDepth(1).replace(/^[\d.,\s]+/, "") : legend.unit}</span>
        ) : null}
        {motion ? (
          <Button variant="outline" className="h-10 shrink-0 px-2.5" onClick={() => set({ wxMapStyle: style === "arrows" ? "particles" : "arrows" })}>
            {style === "arrows" ? "Moving" : "Arrows"}
          </Button>
        ) : null}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="shrink-0 text-t12 text-muted-foreground">Model</span>
        <div className="flex min-w-0 gap-1 overflow-x-auto" role="radiogroup" aria-label="Weather model">
          {ROUTE_MODELS.map((m) => {
            const on = modelId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ wxMapModel: m.id })}
                className={`h-9 shrink-0 rounded-lg px-2.5 text-t12 font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-t12 text-muted-foreground">
        {empty ? <span className="font-semibold text-foreground">{empty} </span> : null}
        Tap the chart for the forecast at a spot · {source}
      </p>
    </div>
  );
}

/** The forecast at the tapped spot and hour (Windy's picker). Drag the pin to move it. */
export function WxProbeCard() {
  useUnitsKey();
  const probe = useHelm((s) => s.wxProbe);
  const layer = useHelm((s) => s.wxMapLayer);
  const at = useHelm((s) => s.wxMapAt);
  const panel = useHelm((s) => s.panel);
  const field = useViewField();
  if (!probe || layer === "off" || panel || !field) return null;
  const p = probeAt(field, at, probe.lat, probe.lng);
  const dir = (d: number | null) => (d == null ? "" : ` ${compassPoint(d)}`);
  const rows: Array<[string, string]> = [];
  if (p.windKn != null) rows.push(["Wind", `${Math.round(p.windKn)} kn${dir(p.windFrom)}${p.gustKn != null ? `, gusts ${Math.round(p.gustKn)}` : ""}`]);
  if (p.waveM != null) rows.push(["Waves", `${formatDepth(p.waveM)}${dir(p.waveFrom)}${p.periodS != null ? `, ${Math.round(p.periodS)} s` : ""}`]);
  if (p.curKn != null && p.curKn >= 0.1) rows.push(["Current", `${p.curKn.toFixed(1)} kn toward${dir(p.curToward)}`]);
  if (p.rainMm != null) rows.push(["Rain", p.rainMm < 0.1 ? "none" : `${p.rainMm.toFixed(1)} mm/h`]);
  if (p.capeJkg != null && p.capeJkg >= 300) rows.push(["Storms", p.capeJkg >= 2000 ? "high risk" : p.capeJkg >= 1000 ? "possible" : "low risk"]);
  if (p.pressureHpa != null) rows.push(["Pressure", `${Math.round(p.pressureHpa)} hPa`]);
  return (
    <div className="pointer-events-auto absolute inset-x-2 top-[calc(max(0.4rem,var(--safe-area-inset-top,env(safe-area-inset-top)))+3.6rem)] z-40 mx-auto max-w-sm rounded-xl border border-border bg-card/97 p-2.5 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-t13 text-muted-foreground tabular-nums">
          This spot · {new Date(at).toLocaleString([], { weekday: "short", hour: "numeric" })}
        </p>
        <button type="button" aria-label="Close" className="-m-1 rounded p-1.5" onClick={() => useHelm.getState().setWxMap({ wxProbe: null })}>
          <X className="size-5" />
        </button>
      </div>
      {rows.length ? (
        <dl className="mt-0.5 grid grid-cols-[5rem_1fr] gap-x-2 gap-y-0.5 text-t15 tabular-nums">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-t14">No forecast here. Pan so the spot is inside the view.</p>
      )}
      <Button
        className="mt-2 h-11 w-full"
        onClick={() => {
          const s = useHelm.getState();
          useHelm.setState({ wxPin: { lat: probe.lat, lng: probe.lng } });
          s.setPanel("weather");
        }}
      >
        Full forecast here
      </Button>
    </div>
  );
}
