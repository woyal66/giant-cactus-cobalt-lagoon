import { useEffect, useMemo } from "react";
import { Cloud, CloudRain, Gauge, Navigation, Pause, Play, Waves, Wind, X, Zap } from "lucide-react";
import { RAIN_BANDS } from "@/lib/rain";
import { Button } from "@/components/ui/button";
import { formatDepth } from "@/lib/units";
import { compassPoint } from "@/lib/routing/explain";
import {
  CURRENT_RAMP,
  MODEL_KM,
  PRESSURE_RAMP,
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
/** How far ahead the timeline runs. */
const DAYS = 7;

const ICON: Record<WxMapLayer, typeof Wind> = {
  wind: Wind,
  gust: Zap,
  rain: CloudRain,
  cloud: Cloud,
  waves: Waves,
  current: Navigation,
  pressure: Gauge,
};

/** Layers with a live view: radar for rain, the satellite for cloud. */
const LIVE_LAYERS = new Set<string>(["rain", "cloud"]);

/** Legend: colour ramp and the numbers shown under it. */
const LEGEND: Partial<Record<WxMapLayer, { ramp: Ramp; ticks: number[]; unit: string }>> = {
  wind: { ramp: WIND_RAMP, ticks: [0, 10, 20, 30, 40, 50], unit: "kn" },
  gust: { ramp: WIND_RAMP, ticks: [0, 10, 20, 30, 40, 50], unit: "kn" },
  current: { ramp: CURRENT_RAMP, ticks: [0, 1, 2, 3], unit: "kn" },
  waves: { ramp: WAVE_RAMP, ticks: [0, 1, 2, 4, 6], unit: "m" },
  pressure: { ramp: PRESSURE_RAMP, ticks: [1000, 1013, 1024], unit: "hPa" },
};

function when(at: number): string {
  const d = new Date(at);
  return d.toLocaleString([], { weekday: "short", hour: "numeric" });
}


/** A small on/off pill for an overlay (Isobars, Animation). */
function Pill({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-t12 font-semibold disabled:opacity-60 ${
        on ? "border-primary bg-primary/20 text-foreground" : "border-border bg-background text-muted-foreground"
      }`}
    >
      <span className={`inline-block size-2.5 rounded-full ${on ? "bg-primary" : "bg-muted-foreground/50"}`} aria-hidden />
      {label}
    </button>
  );
}

/**
 * Weather on the chart, Windy-style: the bar replaces the dock at the bottom of the screen.
 * Layers and close; live or forecast; one slim timeline with the time on the slider; the legend
 * with the Isobars and Animation overlays; the model. Problems only when there are any.
 */
export function WxMapBar() {
  useUnitsKey();
  const layer = useHelm((s) => s.wxMapLayer);
  const style = useHelm((s) => s.wxMapStyle);
  const isobars = useHelm((s) => s.wxIsobars);
  const lowBattery = useHelm((s) => s.lowBattery);
  const at = useHelm((s) => s.wxMapAt);
  const info = useHelm((s) => s.wxMapInfo);
  const panel = useHelm((s) => s.panel);
  const set = useHelm((s) => s.setWxMap);
  const playing = useHelm((s) => s.wxMapPlaying);
  const modelId = useHelm((s) => s.wxMapModel);
  const liveAt = useHelm((s) => s.wxLiveAt);
  const live = useHelm((s) => s.wxLiveInfo);
  const field = useViewField();
  const liveMode = LIVE_LAYERS.has(layer) && liveAt != null;
  const liveFrames = useMemo(() => (liveMode && live?.status === "ok" ? live.frames : []), [liveMode, live]);
  const times = info?.times ?? [];
  const now = Date.now();
  const first = times.find((t) => t >= now - H) ?? times[0] ?? now;
  const last = Math.min(times[times.length - 1] ?? now, first + DAYS * 24 * H);
  const hours = Math.max(0, Math.round((last - first) / H));
  const step = Math.max(0, Math.min(hours, Math.round((at - first) / H)));
  const shown = first + step * H;
  const nowStep = Math.max(0, Math.round((now - first) / H));

  useEffect(() => {
    if (!playing || !liveFrames.length) return;
    const id = window.setInterval(() => {
      const s = useHelm.getState();
      const i = liveFrames.findIndex((t) => t === s.wxLiveAt);
      s.setWxMap({ wxLiveAt: liveFrames[(i + 1) % liveFrames.length]! });
    }, 700);
    return () => window.clearInterval(id);
  }, [playing, liveFrames]);

  useEffect(() => {
    if (!playing || !hours || liveMode) return;
    const id = window.setInterval(() => {
      const s = useHelm.getState();
      const cur = Math.round((s.wxMapAt - first) / H);
      s.setWxMap({ wxMapAt: first + ((cur + 1) % (hours + 1)) * H });
    }, 600);
    return () => window.clearInterval(id);
  }, [playing, hours, first, liveMode]);

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

  // Say so when a layer has nothing to show at this hour.
  const empty = useMemo(() => {
    if (!field || layer === "off" || liveMode) return null;
    const t = layerIndex(field, shown);
    if (layer === "rain") return layerMax(field.precipMm?.[t]) < 0.1 && layerMax(field.capeJkg?.[t]) < 300 ? "No rain or thunder in view at this hour." : null;
    if (layer === "waves" || layer === "current") {
      return Number.isFinite(layerMax((layer === "waves" ? field.waveM : field.curKn)[t])) ? null : "No sea data for this area (inland or very close inshore).";
    }
    return null;
  }, [field, layer, shown, liveMode]);

  if (layer === "off" || panel) return null;
  const marine = layer === "waves" || layer === "current";
  const legend = LEGEND[layer];
  const problem =
    info?.source === "loading"
      ? "Loading the forecast…"
      : info?.source === "saved"
        ? "No signal: showing the saved forecast."
        : info?.source === "passage"
          ? "No signal: showing the passage forecast."
          : info?.source === "kept"
            ? "Couldn't update this area yet: showing the last forecast. Trying again shortly."
            : info?.source === "none"
              ? "No forecast for this area yet."
              : null;
  const pct = hours ? (step / hours) * 100 : 0;
  const close = () => set({ wxMapLayer: "off", wxMapPlaying: false, wxProbe: null, wxLiveAt: null });

  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 mx-auto max-w-2xl rounded-t-2xl md:bottom-3 md:max-w-4xl md:rounded-2xl md:border-b border border-b-0 border-border bg-card/97 px-2 pt-2 pb-[max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))] shadow-[var(--shadow-border)] rp-glass">
      <div className="flex items-center gap-1.5">
        <div className="rp-noscroll flex min-w-0 flex-1 gap-1 overflow-x-auto pb-0.5 md:flex-wrap" role="radiogroup" aria-label="Weather layer">
          {WX_MAP_LAYERS.map((l) => {
            const Icon = ICON[l.id];
            const on = layer === l.id;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => set({ wxMapLayer: l.id, wxLiveAt: LIVE_LAYERS.has(l.id) ? Date.now() : null, wxMapPlaying: false })}
                className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-t13 font-semibold ${on ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}
              >
                <Icon className="size-4" aria-hidden />
                {l.label}
              </button>
            );
          })}
        </div>
        <Button variant="outline" className="h-11 w-11 shrink-0 rounded-full p-0" aria-label="Close the weather map" onClick={close}>
          <X className="size-5" />
        </Button>
      </div>

      {LIVE_LAYERS.has(layer) ? (
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-full bg-background p-0.5" role="radiogroup" aria-label="Live or forecast">
          {[
            { on: liveMode, label: layer === "cloud" ? "Satellite now" : "Radar now + 1 h", pick: () => set({ wxLiveAt: Date.now(), wxMapPlaying: false }) },
            { on: !liveMode, label: `Forecast, ${DAYS} days`, pick: () => set({ wxLiveAt: null, wxMapPlaying: false }) },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              role="radio"
              aria-checked={b.on}
              onClick={b.pick}
              className={`h-10 rounded-full px-2 text-t13 font-semibold ${b.on ? "bg-primary text-primary-foreground" : "text-foreground"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
      ) : null}

      {liveMode ? (
        <LiveStrip />
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <Button
            variant="outline"
            className="h-10 w-10 shrink-0 rounded-full p-0"
            aria-label={playing ? "Pause" : `Play the next ${DAYS} days`}
            disabled={!hours}
            onClick={() => set({ wxMapPlaying: !playing })}
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </Button>
          <div className="relative min-w-0 flex-1 pt-6">
            {/* The time rides on the slider, like Windy's. */}
            <span
              className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md bg-primary px-2 py-0.5 text-t13 font-semibold whitespace-nowrap text-primary-foreground tabular-nums"
              style={{ left: `clamp(2.6rem, ${pct}%, calc(100% - 2.6rem))` }}
            >
              {when(shown)}
            </span>
            {step !== nowStep && hours ? (
              <button type="button" className="absolute top-0 right-0 text-t12 font-semibold text-primary underline" onClick={() => set({ wxMapAt: now, wxMapPlaying: false })}>
                Now
              </button>
            ) : null}
            <input
              type="range"
              min={0}
              max={hours}
              step={1}
              value={step}
              disabled={!hours}
              aria-label="Forecast time"
              aria-valuetext={when(shown)}
              onChange={(e) => set({ wxMapAt: first + Number(e.target.value) * H, wxMapPlaying: false })}
              className="h-7 w-full accent-[var(--color-primary)]"
            />
            <div className="relative h-4 text-t11 text-muted-foreground">
              {days.map((d) => (
                <span key={d.pct} className="absolute border-l border-border pl-1" style={{ left: `${d.pct}%` }}>
                  {d.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* One slim row, like Windy: overlays, the model, and the legend with its numbers inside. */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:flex-nowrap">
        {!liveMode ? (
          <div className="rp-noscroll order-2 flex w-full items-center gap-1.5 overflow-x-auto md:order-1 md:w-auto md:shrink-0">
            <Pill on={isobars} label="Isobars" onClick={() => set({ wxIsobars: !isobars })} />
            <Pill
              on={style === "particles" && !lowBattery}
              disabled={lowBattery}
              label={lowBattery ? "Moving (low battery)" : "Moving"}
              onClick={() => set({ wxMapStyle: style === "arrows" ? "particles" : "arrows" })}
            />
            {marine ? (
              <span className="shrink-0 px-1 text-t12 text-muted-foreground">Marine model</span>
            ) : (
              <div className="flex shrink-0 rounded-full bg-background p-0.5" role="radiogroup" aria-label="Weather model">
                {ROUTE_MODELS.map((m) => {
                  const on = modelId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ wxMapModel: m.id })}
                      className={`h-9 rounded-full px-2.5 text-t12 font-semibold whitespace-nowrap ${on ? "bg-primary text-primary-foreground" : "text-foreground"}`}
                    >
                      {m.label}
                      <span className={`ml-0.5 align-top text-t11 font-normal ${on ? "" : "text-muted-foreground"}`}>{MODEL_KM[m.id] ?? ""}km</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
        <div className="order-1 w-full md:order-2 md:w-auto md:min-w-[14rem] md:flex-1">
          {layer === "rain" ? (
            <div className="flex h-7 overflow-hidden rounded-full text-t11 font-semibold" aria-label="Rain intensity, mm per hour">
              {RAIN_BANDS.map((b) => (
                <span key={b.label} className="grid flex-1 place-items-center truncate px-0.5 text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]" style={{ background: `rgb(${b.color.join(",")})` }}>
                  {b.label === "Very heavy" ? "V. heavy" : b.label === "Moderate" ? "Mod." : b.label}
                </span>
              ))}
              <span className="grid shrink-0 place-items-center bg-background px-2 text-muted-foreground">{liveMode ? "◯ core" : "⚡"}</span>
            </div>
          ) : layer === "cloud" ? (
            liveMode ? null : (
              <div
                className="flex h-7 items-center justify-between rounded-full px-3 text-t11 font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]"
                style={{ background: "linear-gradient(to right, rgba(120,130,150,0.5), rgb(235,240,248))" }}
              >
                <span>Clear</span>
                <span>low cloud greyer</span>
                <span>Overcast</span>
              </div>
            )
          ) : legend ? (
            <div className="relative h-7 rounded-full text-t11 font-semibold text-white tabular-nums [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]" style={{ background: rampGradient(legend.ramp) }}>
              <span className="absolute top-1/2 left-2.5 -translate-y-1/2">{layer === "waves" ? formatDepth(1).replace(/^[\d.,\s]+/, "") : legend.unit}</span>
              {legend.ticks.slice(1).map((v) => {
                const lo = legend.ramp[0]![0];
                const hi = legend.ramp[legend.ramp.length - 1]![0];
                const at2 = Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
                const text = layer === "waves" ? formatDepth(v).replace(/\s*[a-z]+$/i, "").replace(/\.0$/, "") : String(v);
                return (
                  <span key={v} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${Math.max(12, Math.min(94, at2))}%` }}>
                    {text}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {problem || empty ? (
        <p className="mt-1 text-t12 text-muted-foreground">
          {problem ? <span className="font-semibold text-amber-200">{problem} </span> : null}
          {empty ? <span className="font-semibold text-foreground">{empty} </span> : null}
        </p>
      ) : null}
      {liveMode ? (
        <p className="mt-1 text-t12 text-muted-foreground">
          {layer === "cloud" ? "Satellite: NASA GIBS (Himawari, GOES)" : "Radar © RainViewer · the outlook moves the rain along its track; new showers can still pop up"}
        </p>
      ) : null}
    </div>
  );
}

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Live frames: radar for the last hour then the outlook, or the satellite's last two hours. */
function LiveStrip() {
  const live = useHelm((s) => s.wxLiveInfo);
  const at = useHelm((s) => s.wxLiveAt);
  const playing = useHelm((s) => s.wxMapPlaying);
  const set = useHelm((s) => s.setWxMap);
  if (!live || live.status === "loading") return <p className="mt-2 text-t14 text-muted-foreground">Loading the {live?.kind === "sat" ? "satellite picture" : "radar"}…</p>;
  if (live.status === "none" || !live.frames.length) return <p className="mt-2 text-t14">{live.note ?? "Not available right now."}</p>;
  const frames = live.frames;
  let i = 0;
  if (at != null) for (let k = 1; k < frames.length; k++) if (Math.abs(frames[k]! - at) < Math.abs(frames[i]! - at)) i = k;
  const t = frames[i]!;
  const outlook = live.outlookFrom != null && t >= live.outlookFrom;
  const mins = live.latestAt != null ? Math.round((t - live.latestAt) / 60_000) : 0;
  const tag =
    live.kind === "sat"
      ? i === frames.length - 1
        ? "newest picture"
        : `${Math.round((frames[frames.length - 1]! - t) / 60_000)} min earlier`
      : outlook
        ? `outlook +${mins} min`
        : mins === 0
          ? "radar, latest"
          : `radar, ${-mins} min ago`;
  const nowPct = live.outlookFrom != null ? (frames.findIndex((x) => x === live.latestAt) / Math.max(1, frames.length - 1)) * 100 : null;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" className="h-11 w-11 shrink-0 p-0" aria-label={playing ? "Pause" : "Play the loop"} onClick={() => set({ wxMapPlaying: !playing })}>
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </Button>
        <div className="relative min-w-0 flex-1">
          <div className="mb-0.5 flex items-baseline justify-between gap-2">
            <span className="text-t15 font-semibold tabular-nums">{clock(t)}</span>
            <span className={`text-t13 ${outlook ? "font-semibold text-amber-200" : "text-muted-foreground"}`}>{tag}</span>
          </div>
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            step={1}
            value={i}
            aria-label={live.kind === "sat" ? "Satellite picture time" : "Radar time"}
            onChange={(e) => set({ wxLiveAt: frames[Number(e.target.value)]!, wxMapPlaying: false })}
            className="h-8 w-full accent-[var(--color-primary)]"
          />
          {nowPct != null ? (
            <div className="relative h-4 text-t11 text-muted-foreground">
              <span className="absolute left-0">past hour</span>
              <span className="absolute -translate-x-1/2 border-l border-border pl-1" style={{ left: `${nowPct}%` }}>
                now
              </span>
              <span className="absolute right-0">next hour</span>
            </div>
          ) : null}
        </div>
      </div>
      {live.here ? <p className="mt-1 text-t14 font-semibold">{live.here}</p> : null}
      {live.motion || live.note ? (
        <p className="text-t13 text-muted-foreground">
          {[live.motion, live.note].filter(Boolean).join(" · ")}
        </p>
      ) : null}
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
  const deg = (d: number | null) => (d == null ? "" : ` ${compassPoint(d)} ${String(Math.round(d) % 360).padStart(3, "0")}°`);
  const rows: Array<[string, string]> = [];
  if (p.windKn != null) rows.push(["Wind", `${Math.round(p.windKn)} kn${deg(p.windFrom)}${p.gustKn != null ? `, gust ${Math.round(p.gustKn)}` : ""}`]);
  if (p.waveM != null) rows.push(["Waves", `${formatDepth(p.waveM)}${deg(p.waveFrom)}${p.periodS != null ? `, ${Math.round(p.periodS)} s` : ""}`]);
  if (p.curKn != null && p.curKn >= 0.1) rows.push(["Current", `${p.curKn.toFixed(1)} kn toward${dir(p.curToward)}`]);
  if (p.rainMm != null) rows.push(["Rain", p.rainMm < 0.1 ? "none" : `${p.rainMm.toFixed(1)} mm/h`]);
  if (p.cloudPct != null) rows.push(["Cloud", `${Math.round(p.cloudPct)}%${p.lowCloudPct != null ? `, low ${Math.round(p.lowCloudPct)}%` : ""}`]);
  if (p.capeJkg != null && p.capeJkg >= 300) rows.push(["Thunder", p.capeJkg >= 2000 ? "high risk" : p.capeJkg >= 1000 ? "possible" : "low risk"]);
  if (p.pressureHpa != null) rows.push(["hPa", String(Math.round(p.pressureHpa))]);
  return (
    <div className="pointer-events-auto absolute top-[calc(max(0.4rem,var(--safe-area-inset-top,env(safe-area-inset-top)))+3.6rem)] right-2 z-40 w-[min(17rem,calc(100vw-6.5rem))] rounded-xl border border-border bg-card/95 p-2 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-t12 text-muted-foreground tabular-nums">
          This spot · {new Date(at).toLocaleString([], { weekday: "short", hour: "numeric" })}
        </p>
        <button type="button" aria-label="Close" className="-m-1 rounded p-1.5" onClick={() => useHelm.getState().setWxMap({ wxProbe: null })}>
          <X className="size-5" />
        </button>
      </div>
      {rows.length ? (
        <dl className="mt-0.5 grid grid-cols-[3.6rem_1fr] gap-x-1.5 text-t13 leading-snug tabular-nums">
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
        size="sm"
        className="mt-1.5 w-full"
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
