import { useRef, useState, type ComponentType, type PointerEvent } from "react";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeatherTable } from "@/components/helm/weather-table";
import { toast } from "sonner";
import { useSpotWx, useWx } from "@/hooks/weather";
import {
  beaufort,
  clockLabel,
  currentVsHeading,
  dayClock,
  dayStamp,
  formatKn,
  graphAreaTimed,
  graphLineTimed,
  graphMaxKn,
  graphXAt,
  horizonLabel,
  hourLabel,
  axisMarks,
  nearestSample,
  skyLabel,
  sliceByHorizon,
  windowStats,
  windCardinal,
  clampWxHorizon,
  WX_MODEL_LABEL,
  type CurrentHour,
  type SeaState,
  type WaveHour,
  type WxForecast,
  type WxHour,
  type WxSky,
} from "@/lib/weather";
import { bearingDegrees, formatHeading, formatLat, formatLng, formatMeters, haversineMeters } from "@/lib/geo";
import { hoursUntil } from "@/lib/anchor";
import { cn } from "@/lib/utils";
import { isDaylight, nightSpans } from "@/lib/sun";
import {
  latDatumM,
  nextTurn,
  tideAt,
  tideRange,
  tideRiseAt,
  tideRising,
  toLatM,
  windowTide,
  type TideHour,
  type TideOrigin,
  type TideTurn,
} from "@/lib/tides";
import { tideOriginChip, tideOriginLabel } from "@/lib/tide-station";
import { chartedDepthNeededM } from "@/lib/boat";
import { useHelm, useUnitsKey } from "@/store/helm";
import { formatDepth, getUnits } from "@/lib/units";
import { MoonCard } from "@/components/helm/moon-card";

const SKY_ICON: Record<WxSky, ComponentType<{ className?: string }>> = {
  clear: Sun,
  partly: CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  rain: CloudRain,
  heavy: CloudRain,
  storm: CloudLightning,
  snow: CloudSnow,
};

function WindArrow({ deg, className }: { deg: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className ?? "size-5"}
      style={{ transform: `rotate(${deg + 180}deg)` }}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12 3.2 16.4 12H13v8.8h-2V12H7.6L12 3.2Z"
      />
    </svg>
  );
}

export function WxStrip() {
  const panel = useHelm((s) => s.panel);
  const setPanel = useHelm((s) => s.setPanel);
  const wx = useWx();
  if (panel) return null;
  const data = wx.data;
  if (!data && !wx.isLoading && !wx.isError) return null;

  return (
    <div className="pointer-events-none absolute inset-x-16 bottom-[5.6rem] z-20 hidden md:inset-x-auto md:left-1/2 md:block md:w-[min(42rem,calc(100%-9rem))] md:-translate-x-1/2">
      <div className="pointer-events-auto flex w-full items-stretch gap-2 overflow-hidden rounded-xl border border-border bg-card/95 px-2 py-2 shadow-[var(--shadow-border)] rp-glass">
        {wx.isLoading && !data ? (
          <p className="px-2 py-1 text-sm text-muted-foreground">Fetching wind…</p>
        ) : wx.isError && !data ? (
          <button
            type="button"
            className="px-2 py-1 text-left text-sm text-muted-foreground"
            onClick={() => setPanel("weather")}
          >
            Wind unavailable — tap for details.
          </button>
        ) : data ? (
          <>
            <button
              type="button"
              onClick={() => setPanel("weather")}
              className="shrink-0 rounded-lg text-left"
              aria-label="Open 24 hour wind and weather"
            >
              <NowChip hour={data.now} />
            </button>
            <div
              className="flex min-w-0 flex-1 cursor-pointer gap-0.5 overflow-x-auto"
              onClick={() => setPanel("weather")}
            >
              {data.hours.slice(0, 24).map((h, i) => (
                <HourCol
                  key={h.at}
                  hour={h}
                  max={data.maxWind.at === h.at}
                  now={i === 0}
                  peak={data.maxWind.windKn}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function NowChip({ hour }: { hour: WxHour }) {
  const b = beaufort(hour.windKn);
  return (
    <div className="flex shrink-0 items-center gap-2 rounded-lg bg-background px-2 py-1">
      <WindArrow deg={hour.dirDeg} className="size-6 text-primary" />
      <div>
        <p className="font-display text-xl leading-none font-semibold tabular-nums">
          {formatKn(hour.windKn)}
          <span className="ml-1 text-xs font-medium text-muted-foreground">kn</span>
        </p>
        <p className="text-t12 text-muted-foreground">
          {windCardinal(hour.dirDeg)} · {b.label}
        </p>
      </div>
    </div>
  );
}

function HourCol({
  hour,
  max,
  now,
  peak,
}: {
  hour: WxHour;
  max: boolean;
  now: boolean;
  peak: number;
}) {
  const h = Math.max(4, Math.round((hour.windKn / Math.max(8, peak)) * 28));
  return (
    <div
      className={`flex w-9 shrink-0 flex-col items-center gap-0.5 rounded-md px-0.5 py-0.5 ${
        max ? "bg-primary/15" : now ? "bg-muted/60" : ""
      }`}
    >
      <span className="text-t12 text-muted-foreground">
        {now ? "Now" : hourLabel(hour.at)}
      </span>
      <span
        className={`mt-auto w-1.5 rounded-full ${
          hour.windKn >= 22 ? "bg-destructive" : "bg-primary"
        }`}
        style={{ height: h }}
      />
      <span className="font-display text-xs leading-none font-semibold tabular-nums">
        {Math.round(hour.windKn)}
      </span>
    </div>
  );
}

export function WeatherPanel() {
  useUnitsKey();
  const panel = useHelm((s) => s.panel);
  const setPanel = useHelm((s) => s.setPanel);
  const pin = useHelm((s) => s.wxPin);
  const setWxPin = useHelm((s) => s.setWxPin);
  const boat = useHelm((s) => s.boat);
  const horizonH = useHelm((s) => s.wxHorizonH);
  const setHorizon = useHelm((s) => s.setWxHorizonH);
  const boatWx = useWx();
  const spot = useSpotWx(pin?.lat ?? null, pin?.lng ?? null);
  const wx = pin ? spot : boatWx;
  if (panel !== "weather") return null;
  const data = wx.data;
  const fromBoat =
    pin && boat ? haversineMeters(boat, pin) : null;
  const brg = pin && boat ? formatHeading(bearingDegrees(boat, pin)) : null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 flex flex-col overflow-x-hidden overflow-y-auto bg-card pt-[max(0.4rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="sticky top-0 z-10 border-b border-border/60 bg-card/95 px-3 py-1.5 backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {pin ? "Forecast at pin" : "Forecast"}
            </h2>
            <p className="truncate text-t13 text-muted-foreground">
              {pin
                ? fromBoat != null
                  ? `${formatMeters(fromBoat)} · ${brg} from the boat`
                  : `${formatLat(pin.lat)} ${formatLng(pin.lng)}`
                : "At the boat"}
              {` · ${horizonLabel(horizonH)}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => {
                const fix = useHelm.getState().boat;
                if (!fix || (fix.source !== "gps" && fix.source !== "last" && fix.source !== "demo")) {
                  toast("No GPS fix yet.");
                  return;
                }
                setWxPin({ lat: fix.lat, lng: fix.lng });
              }}
            >
              GPS
            </Button>
            {pin ? (
              <Button variant="outline" size="sm" className="h-8 px-2" onClick={() => setWxPin(null)}>
                Boat
              </Button>
            ) : null}
            <Button variant="outline" size="sm" className="h-10 min-w-16 px-3" onClick={() => setPanel(null)}>
              Close
            </Button>
          </div>
        </div>
      </div>
      <div className="w-full max-w-full px-3 pt-2">
        <MoonCard />
        {wx.isLoading && !data ? (
          <p className="text-sm text-muted-foreground">Fetching forecast…</p>
        ) : null}
        {wx.isError && !data ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">Forecast did not load.</p>
            <Button variant="outline" onClick={() => void wx.refetch()}>
              Retry
            </Button>
          </div>
        ) : null}
        {data ? <WxBody data={data} horizonH={horizonH} onHorizon={setHorizon} /> : null}
      </div>
    </div>
  );
}

type GraphLayers = {
  wind: boolean;
  tide: boolean;
  current: boolean;
  waves: boolean;
};

type WindModelId = "ecmwf" | "gfs" | "ukmo" | "icon";

const WIND_LOOK: Record<
  WindModelId,
  { label: string; chip: string; off: string; wind: string; gust: string; arrow: string }
> = {
  ecmwf: {
    label: "ECMWF",
    chip: "border-primary bg-primary/15 text-primary",
    off: "border-primary/70 text-primary",
    wind: "text-primary",
    gust: "text-teal-200",
    arrow: "fill-primary",
  },
  gfs: {
    label: "GFS",
    chip: "border-amber-300 bg-amber-300/15 text-amber-300",
    off: "border-amber-300/70 text-amber-300",
    wind: "text-amber-300",
    gust: "text-amber-200",
    arrow: "fill-amber-300",
  },
  ukmo: {
    label: "UKMO",
    chip: "border-indigo-300 bg-indigo-300/15 text-indigo-300",
    off: "border-indigo-300 text-indigo-300",
    wind: "text-indigo-300",
    gust: "text-indigo-200",
    arrow: "fill-indigo-300",
  },
  icon: {
    label: "ICON",
    chip: "border-lime-300 bg-lime-300/15 text-lime-300",
    off: "border-lime-300 text-lime-300",
    wind: "text-lime-300",
    gust: "text-lime-200",
    arrow: "fill-lime-300",
  },
};

const WIND_ORDER: WindModelId[] = ["ecmwf", "gfs", "ukmo", "icon"];

function isWindModel(source: string): source is WindModelId {
  return source === "ecmwf" || source === "gfs" || source === "ukmo" || source === "icon";
}

function WxBody({
  data,
  horizonH,
  onHorizon,
}: {
  data: WxForecast;
  horizonH: number;
  onHorizon: (h: number) => void;
}) {
  const upcoming = sliceByHorizon(data.hours, horizonH);
  const hours = data.hours;
  const available: Array<{ id: WindModelId; hours: WxHour[] }> = [];
  if (isWindModel(data.source)) available.push({ id: data.source, hours: data.hours });
  for (const id of WIND_ORDER) {
    if (available.some((s) => s.id === id)) continue;
    const extra = data.compare?.find((s) => s.source === id);
    if (extra && extra.hours.length >= 2) available.push({ id, hours: extra.hours });
  }
  const onModels = useHelm((s) => s.wxModels);
  const setWxModels = useHelm((s) => s.setWxModels);
  const toggleModel = (id: WindModelId) => {
    const next = { ...onModels, [id]: !onModels[id] };
    if (!available.some((m) => next[m.id])) return;
    setWxModels(next);
  };
  const shown = available.filter((m) => onModels[m.id]);
  const stats = windowStats(upcoming.length ? upcoming : data.hours.slice(0, 1));
  const maxB = beaufort(stats.maxWind.windKn);
  const strong = stats.maxWind.windKn >= 22;
  const setHours = data.sea?.currentHours ?? [];
  const waveHours = data.sea?.waveHours ?? [];
  const hasTide = Boolean(data.sea && data.sea.tideHours.length >= 2);
  const hasCurrent = setHours.length >= 4;
  const hasWaves = waveHours.length >= 4;
  const layers = useHelm((s) => s.wxLayers);
  const setWxLayers = useHelm((s) => s.setWxLayers);
  const toggle = (key: keyof GraphLayers) => {
    const next = { ...layers, [key]: !layers[key] };
    if (!next.wind && !next.tide && !next.current && !next.waves) return;
    setWxLayers(next);
  };

  const chips: Array<{ key: keyof GraphLayers; label: string; on: boolean; show: boolean }> = [
    { key: "wind", label: "Wind", on: layers.wind, show: true },
    {
      key: "tide",
      label: tideOriginChip(data.sea?.tideOrigin ?? null),
      on: layers.tide,
      show: hasTide,
    },
    { key: "current", label: "Current", on: layers.current, show: hasCurrent },
    { key: "waves", label: "Waves", on: layers.waves, show: hasWaves },
  ];

  return (
    <div className="grid w-full max-w-full grid-cols-[minmax(0,1fr)] gap-3">
      {strong ? (
        <p className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-sm text-destructive">
          {maxB.label} later — {formatKn(stats.maxWind.windKn)} kn {windCardinal(stats.maxWind.dirDeg)}{" "}
          at {dayStamp(stats.maxWind.at)} {hourLabel(stats.maxWind.at)}
        </p>
      ) : null}

      <div className="grid gap-1">
        <div className="flex flex-wrap gap-1">
          {chips
            .filter((c) => c.show)
            .map((c) => (
              <Button
                key={c.key}
                variant={c.on ? "default" : "outline"}
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() => toggle(c.key)}
              >
                {c.label}
              </Button>
            ))}
        </div>
        {layers.wind ? (
          <div className="flex gap-1">
            {WIND_ORDER.map((id) => {
              const row = available.find((m) => m.id === id);
              const live = Boolean(row && row.hours.length >= 2);
              const on = live && onModels[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (!live) {
                      toast("That model has no wind just now.");
                      return;
                    }
                    toggleModel(id);
                  }}
                  className={`h-8 min-w-0 flex-1 rounded-md border px-1 text-xs ${
                    on ? WIND_LOOK[id].chip : live ? WIND_LOOK[id].off : `${WIND_LOOK[id].off} opacity-45`
                  }`}
                >
                  {WIND_LOOK[id].label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <SeaStack
        hours={hours}
        windSeries={shown}
        horizonH={horizonH}
        tideHours={data.sea?.tideHours}
        tideTurns={data.sea?.tideTurns}
        latDatum={data.sea?.latDatumM ?? null}
        tideOrigin={data.sea?.tideOrigin ?? null}
        currentHours={setHours}
        waveHours={waveHours}
        layers={layers}
        lat={data.lat}
        lng={data.lng}
        onHorizon={onHorizon}
      />
    </div>
  );
}

const GRAPH_W = 320;
const GRAPH_H = 228;
const CUR_H = 128;
const PAD_L = 34;
const PAD_R = 36;
const PAD_T = 14;
const PAD_B = 22;
const DAY_FILL = "#16324a";
/** Night: a deeper navy, not black, so it reads as "dark hours" without swamping the lines. */
const NIGHT_FILL = "#0b1828";
const LANE_H = 120;
const LANES: Array<{ key: keyof GraphLayers; title: string }> = [
  { key: "wind", title: "Wind and gusts (kn)" },
  { key: "waves", title: "Sea" },
  { key: "tide", title: "Tide" },
  { key: "current", title: "Current (kn)" },
];
const TWILIGHT_MS = 50 * 60_000;

function SeaStack({
  hours,
  windSeries,
  horizonH,
  tideHours,
  tideTurns,
  latDatum,
  tideOrigin,
  currentHours,
  waveHours,
  layers,
  lat,
  lng,
  onHorizon,
}: {
  hours: WxHour[];
  windSeries: Array<{ id: WindModelId; hours: WxHour[] }>;
  horizonH: number;
  tideHours?: TideHour[];
  tideTurns?: TideTurn[];
  latDatum: number | null;
  tideOrigin: TideOrigin | null;
  currentHours: CurrentHour[];
  waveHours: WaveHour[];
  layers: GraphLayers;
  lat: number;
  lng: number;
  onHorizon: (h: number) => void;
}) {
  const t0 = hours[0]?.at ?? Date.now();
  const seriesEnd = hours[hours.length - 1]?.at ?? t0;
  const span = horizonH * 3_600_000;
  const earliest = t0;
  const latest = Math.max(earliest, seriesEnd - span);
  const [viewStart, setViewStart] = useState(earliest);
  const [seenSeries, setSeenSeries] = useState(earliest);
  if (seenSeries !== earliest) {
    setSeenSeries(earliest);
    setViewStart(earliest);
  }
  const windowStart = Math.min(latest, Math.max(earliest, viewStart));
  const windowEnd = windowStart + span;
  const canPan = latest - earliest > 30 * 60_000;
  const now = Date.now();
  const [cursorAt, setCursorAt] = useState(() => Math.min(earliest + span, Math.max(earliest, now)));
  const shiftWindow = (deltaMs: number) => {
    setViewStart((start) => {
      const next = Math.min(latest, Math.max(earliest, start + deltaMs));
      setCursorAt((c) => Math.min(next + span, Math.max(next, c)));
      return next;
    });
  };
  const zoomWindow = (nextH: number, anchorAt: number, anchorU: number) => {
    const h = clampWxHorizon(nextH);
    const spanMs = h * 3_600_000;
    const late = Math.max(earliest, seriesEnd - spanMs);
    const start = Math.min(late, Math.max(earliest, anchorAt - anchorU * spanMs));
    onHorizon(h);
    setViewStart(start);
    setCursorAt((c) => Math.min(start + spanMs, Math.max(start, c)));
  };
  const cursor = Math.min(windowEnd, Math.max(windowStart, cursorAt));
  const when = dayClock(cursor, now);
  const tides = tideHours ? windowTide(tideHours, windowStart, horizonH) : [];
  const datum =
    tideOrigin?.kind === "station" ? 0 : (latDatum ?? (tides.length ? latDatumM(tides) : 0));
  const tideMsl = tides.length ? tideAt(tides, cursor) : null;
  const tideM = tideMsl != null ? toLatM(tideMsl, datum) : null;
  const rising = tides.length ? tideRising(tides, cursor) : null;
  const cur = nearestSample(currentHours, cursor);
  const wave = nearestSample(waveHours, cursor);

  // One lane per layer, each with its own scale, all on one time axis with one cursor.
  // A single shared graph with two scales and every layer on was unreadable.
  const lanes = LANES.filter((l) => layers[l.key]).filter(
    (l) =>
      l.key === "wind" ||
      (l.key === "tide" && (tideHours?.length ?? 0) >= 2) ||
      (l.key === "current" && currentHours.length >= 2) ||
      (l.key === "waves" && waveHours.length >= 2),
  );
  const tideAtCell =
    tideHours && tideHours.length >= 2
      ? (at: number) => {
          const all = windowTide(tideHours, at - 3_600_000, 2);
          const v = all.length ? tideAt(all, at) : null;
          return v == null ? null : toLatM(v, datum);
        }
      : null;

  return (
    <div className="grid w-full max-w-full grid-cols-[minmax(0,1fr)] gap-2">
      {lanes.map((lane) => (
        <div key={lane.key}>
          <p className="mb-0.5 text-t12 font-medium text-muted-foreground">{lane.title}</p>
          <ForecastGraph
            hours={hours}
            windSeries={windSeries}
            horizonH={horizonH}
            tideHours={tideHours}
            tideTurns={tideTurns}
            latDatum={datum}
            layers={{ wind: false, tide: false, current: false, waves: false, [lane.key]: true }}
            currentHours={currentHours}
            waveHours={waveHours}
            cursorAt={cursor}
            onCursor={setCursorAt}
            windowStart={windowStart}
            onPan={canPan ? shiftWindow : undefined}
            onZoom={zoomWindow}
            height={lane.key === "wind" ? GRAPH_H - 28 : LANE_H}
            lat={lat}
            lng={lng}
          />
        </div>
      ))}
      <div className="rounded-xl border border-border bg-background px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-lg leading-none font-semibold tabular-nums">
            {clockLabel(cursor)}
          </p>
          <p className="truncate text-t13 text-muted-foreground">
            {[when.label, when.hint, isDaylight(lat, lng, cursor) ? "Day" : "Night"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {layers.wind && windSeries.length ? (
          <div
            className={`mt-2 grid gap-x-2 gap-y-1 ${
              windSeries.length >= 4
                ? "grid-cols-4"
                : windSeries.length === 3
                  ? "grid-cols-3"
                  : windSeries.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-1"
            }`}
          >
            {windSeries.map((s) => {
              const sample = nearestSample(s.hours, cursor);
              if (!sample) return null;
              const gust = sample.gustKn;
              const warn = gust != null && gust >= GUST_WARN_KN;
              const look = WIND_LOOK[s.id];
              return (
                <div key={s.id} className="min-w-0">
                  <p className={`flex items-center gap-0.5 text-t12 ${look.wind}`}>
                    <MiniArrow deg={sample.dirDeg + 180} className={warn ? "text-destructive" : look.wind} />
                    {look.label}
                  </p>
                  <p
                    className={`font-display text-lg leading-none font-semibold tabular-nums ${
                      warn ? "text-destructive" : ""
                    }`}
                  >
                    {formatKn(gust ?? sample.windKn)}
                  </p>
                  <p className="truncate text-t12 text-muted-foreground">
                    {gust != null ? `${formatKn(sample.windKn)} · ` : ""}
                    {windCardinal(sample.dirDeg)}
                  </p>
                </div>
              );
            })}
          </div>
        ) : null}
        {layers.tide || layers.waves || layers.current ? (
          <div className="mt-2 flex gap-2 border-t border-border/70 pt-1.5">
            {layers.tide && tideM != null ? (
              <p className="min-w-0 flex-1 text-t13 leading-tight">
                <span className="text-t12 text-muted-foreground">
                  {tideOrigin?.kind === "station" ? "Tide" : "Tide est"}
                </span>
                <span className="mt-0.5 block font-display text-base leading-none font-semibold tabular-nums">
                  {formatDepth(tideM)}
                </span>
                <span className="text-t12 text-muted-foreground">
                  {rising == null ? "Slack" : rising ? "Rising" : "Falling"}
                </span>
              </p>
            ) : null}
            {layers.waves && wave ? (
              <p className="min-w-0 flex-1 text-t13 leading-tight text-cyan-300">
                <span className="flex items-center gap-0.5 text-t12">
                  <MiniArrow deg={wave.dirDeg + 180} className="text-cyan-300" />
                  Waves
                </span>
                <span className="mt-0.5 block font-display text-base leading-none font-semibold text-foreground tabular-nums">
                  {formatDepth(wave.heightM, { unit: getUnits().depth === "fm" ? "ft" : undefined })}
                </span>
                <span className="text-t12 text-muted-foreground">
                  {wave.periodS ? `${wave.periodS} s · ` : ""}
                  {windCardinal((wave.dirDeg + 180) % 360)}
                </span>
              </p>
            ) : null}
            {layers.current && cur ? (
              <p className="min-w-0 flex-1 text-t13 leading-tight text-amber-300">
                <span className="flex items-center gap-0.5 text-t12">
                  <MiniArrow deg={cur.dirDeg} className="text-amber-300" />
                  Current
                </span>
                <span className="mt-0.5 block font-display text-base leading-none font-semibold text-foreground tabular-nums">
                  {formatKn(cur.kn)} kn
                </span>
                <span className="text-t12 text-muted-foreground">{windCardinal(cur.dirDeg)}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <WeatherTable
        hours={hours}
        waveHours={waveHours}
        currentHours={currentHours}
        tideAt={tideAtCell}
        windowStart={windowStart}
        horizonH={horizonH}
        cursorAt={cursor}
        onCursor={setCursorAt}
      />
    </div>
  );
}

function NightShade({
  lat,
  lng,
  t0,
  horizonH,
  height,
  padT,
  padB,
}: {
  lat: number;
  lng: number;
  t0: number;
  horizonH: number;
  height: number;
  padT: number;
  padB: number;
}) {
  const tEnd = t0 + horizonH * 3_600_000;
  const innerH = Math.max(0, height - padT - padB);
  const plotW = GRAPH_W - PAD_L - PAD_R;
  const nights = nightSpans(lat, lng, t0, tEnd);
  const gid = `dusk-${Math.round(t0)}-${height}-${padT}`;
  return (
    <g className="pointer-events-none">
      <defs>
        {nights.map((n, i) => {
          const fadeIn = n.start > t0 + 30_000;
          const fadeOut = n.end < tEnd - 30_000;
          const visStart = fadeIn ? n.start - TWILIGHT_MS : n.start;
          const visEnd = fadeOut ? n.end + TWILIGHT_MS : n.end;
          const x0 = graphXAt(visStart, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
          const x1 = graphXAt(visEnd, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
          const span = Math.max(1, visEnd - visStart);
          const inOff = fadeIn ? (TWILIGHT_MS / span) * 100 : 0;
          const outOff = fadeOut ? 100 - (TWILIGHT_MS / span) * 100 : 100;
          return (
            <linearGradient
              key={n.start}
              id={`${gid}-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={x0}
              y1={padT}
              x2={x1}
              y2={padT}
            >
              <stop offset="0%" stopColor={NIGHT_FILL} stopOpacity={fadeIn ? 0 : 1} />
              <stop offset={`${inOff}%`} stopColor={NIGHT_FILL} stopOpacity="1" />
              <stop offset={`${outOff}%`} stopColor={NIGHT_FILL} stopOpacity="1" />
              <stop offset="100%" stopColor={NIGHT_FILL} stopOpacity={fadeOut ? 0 : 1} />
            </linearGradient>
          );
        })}
      </defs>
      <rect x={PAD_L} y={padT} width={plotW} height={innerH} style={{ fill: DAY_FILL }} />
      {nights.map((n, i) => {
        const fadeIn = n.start > t0 + 30_000;
        const fadeOut = n.end < tEnd - 30_000;
        const visStart = fadeIn ? n.start - TWILIGHT_MS : n.start;
        const visEnd = fadeOut ? n.end + TWILIGHT_MS : n.end;
        const x0 = graphXAt(visStart, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
        const x1 = graphXAt(visEnd, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
        return (
          <rect
            key={n.start}
            x={x0}
            y={padT}
            width={Math.max(0, x1 - x0)}
            height={innerH}
            fill={`url(#${gid}-${i})`}
          />
        );
      })}
    </g>
  );
}

const GUST_WARN_KN = 25;

function gustWarnPath(
  points: { at: number; v: number }[],
  xOf: (at: number) => number,
  yOf: (kn: number) => number,
): string {
  let d = "";
  let pen = false;
  const pt = (at: number, v: number) => `${xOf(at).toFixed(1)} ${yOf(v).toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const aHi = a.v >= GUST_WARN_KN;
    const bHi = b.v >= GUST_WARN_KN;
    if (!aHi && !bHi) {
      pen = false;
      continue;
    }
    let aAt = a.at;
    let aV = a.v;
    let bAt = b.at;
    let bV = b.v;
    if (aHi !== bHi && b.v !== a.v) {
      const t = (GUST_WARN_KN - a.v) / (b.v - a.v);
      const cAt = a.at + (b.at - a.at) * t;
      if (aHi) {
        bAt = cAt;
        bV = GUST_WARN_KN;
      } else {
        aAt = cAt;
        aV = GUST_WARN_KN;
      }
    }
    if (!pen) d += `M${pt(aAt, aV)} `;
    d += `L${pt(bAt, bV)} `;
    pen = bHi;
  }
  return d.trim();
}

function windGlance(wx: WxHour, name?: string) {
  const gust = wx.gustKn;
  const warn = gust != null && gust >= GUST_WARN_KN;
  return {
    label: name ? `${name} gust` : gust != null ? "Gust" : "Wind",
    value: `${formatKn(gust ?? wx.windKn)} kn`,
    hint:
      gust != null
        ? `${formatKn(wx.windKn)} mean · ${windCardinal(wx.dirDeg)}`
        : windCardinal(wx.dirDeg),
    valueClass: warn ? "text-2xl text-destructive" : "text-2xl",
    arrowDeg: wx.dirDeg + 180,
    arrowClass: warn
      ? "text-destructive"
      : (Object.values(WIND_LOOK).find((l) => l.label === name)?.wind ?? undefined),
  };
}

function MiniArrow({ deg, className }: { deg: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`size-4 shrink-0 ${className ?? ""}`}
      style={{ transform: `rotate(${deg}deg)` }}
      aria-hidden
    >
      <path
        fill="currentColor"
        stroke="#0b1c24"
        strokeWidth="1.2"
        strokeLinejoin="round"
        d="M12 2.2 18.4 20.2 12 15.4 5.6 20.2Z"
      />
    </svg>
  );
}

function ReadoutCell({
  label,
  value,
  hint,
  arrowDeg,
  arrowClass,
  valueClass,
}: {
  label: string;
  value: string;
  hint?: string;
  arrowDeg?: number;
  arrowClass?: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {arrowDeg != null ? (
        <svg
          viewBox="0 0 24 24"
          className={`mt-0.5 size-6 shrink-0 ${arrowClass ?? "text-primary"}`}
          style={{ transform: `rotate(${arrowDeg}deg)` }}
          aria-hidden
        >
          <path
            fill="currentColor"
            stroke="#0b1c24"
            strokeWidth="1.2"
            strokeLinejoin="round"
            d="M12 2.2 18.4 20.2 12 15.4 5.6 20.2Z"
          />
        </svg>
      ) : null}
      <div className="min-w-0">
        <p className="text-t12 text-muted-foreground">{label}</p>
        <p className={cn("font-display text-xl leading-none font-semibold tabular-nums", valueClass)}>
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-t13 text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

function CurrentNow({ sea }: { sea: SeaState }) {
  const heading = useHelm((s) => s.boat?.heading ?? s.lastFix?.heading ?? null);
  if (sea.currentKn == null || sea.currentDir == null) return null;
  const vs =
    heading != null
      ? currentVsHeading(sea.currentKn, sea.currentDir, heading)
      : null;
  const along =
    vs == null
      ? null
      : Math.abs(vs.alongKn) < 0.15
        ? "abeam"
        : vs.alongKn > 0
          ? `${formatKn(vs.alongKn)} kn with you`
          : `${formatKn(-vs.alongKn)} kn against`;
  const across =
    vs == null || Math.abs(vs.acrossKn) < 0.15
      ? null
      : `${formatKn(Math.abs(vs.acrossKn))} kn set ${vs.acrossKn > 0 ? "stb" : "port"}`;
  return (
    <div className="mt-3 rounded-md border border-border bg-card/60 px-2.5 py-2">
      <p className="text-t12 text-muted-foreground">Current</p>
      <p className="font-display text-2xl leading-none font-semibold tabular-nums">
        {formatKn(sea.currentKn)}
        <span className="ml-1 text-xs font-medium text-muted-foreground">kn</span>
        <span className="ml-2 text-base font-medium text-muted-foreground">
          to {windCardinal(sea.currentDir)}
        </span>
      </p>
      {along ? (
        <p className="mt-1 text-t14 text-muted-foreground">
          {along}
          {across ? ` · ${across}` : ""}
        </p>
      ) : (
        <p className="mt-1 text-t14 text-muted-foreground">Place heading to see with / against.</p>
      )}
    </div>
  );
}

function SeaLayerGraph({
  points,
  horizonH,
  t0,
  cursorAt,
  onCursor,
  maxY,
  unit,
  fill,
  lat,
  lng,
}: {
  points: Array<{ at: number; v: number; dirDeg: number }>;
  horizonH: number;
  t0: number;
  cursorAt: number;
  onCursor: (at: number) => void;
  maxY: number;
  unit: string;
  fill?: boolean;
  lat?: number;
  lng?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  if (points.length < 2) return null;
  const now = Date.now();
  const tEnd = t0 + horizonH * 3_600_000;
  const innerH = CUR_H - 10 - 22;
  const d = graphLineTimed(
    points.map((h) => ({ at: h.at, v: h.v })),
    t0,
    horizonH,
    GRAPH_W,
    CUR_H,
    maxY,
    PAD_L,
    PAD_R,
    10,
    22,
  );
  const cursor = Math.min(tEnd, Math.max(t0, cursorAt));
  const cursorX = graphXAt(cursor, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
  const nowX = graphXAt(now, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
  const arrowEvery = horizonH <= 24 ? 3 : horizonH <= 48 ? 4 : 12;
  const yAt = (v: number) => 10 + innerH - (v / Math.max(0.4, maxY)) * innerH;
  const cursorHour = nearestSample(points, cursor);

  const onDown = (ev: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    dragging.current = true;
    try {
      svg.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    onCursor(pointerToAt(ev, svg, t0, horizonH));
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${GRAPH_W} ${CUR_H}`}
      className={fill ? "size-full touch-none" : "h-auto w-full touch-none"}
      preserveAspectRatio={fill ? "none" : "xMidYMid meet"}
      aria-label={`Sea ${unit} graph`}
      onPointerDown={onDown}
      onPointerMove={(ev) => {
        if (!dragging.current || !svgRef.current) return;
        onCursor(pointerToAt(ev, svgRef.current, t0, horizonH));
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      {lat != null && lng != null ? (
        <NightShade
          lat={lat}
          lng={lng}
          t0={t0}
          horizonH={horizonH}
          height={CUR_H}
          padT={10}
          padB={22}
        />
      ) : null}
      {[maxY, maxY / 2].map((g) => {
        const y = yAt(g);
        return (
          <g key={g}>
            <line
              x1={PAD_L}
              x2={GRAPH_W - PAD_R}
              y1={y}
              y2={y}
              stroke="currentColor"
              className="text-border"
              strokeWidth="1"
            />
            <text x="2" y={y + 3} className="fill-muted-foreground" fontSize="9">
              {g}
              {g === maxY ? ` ${unit}` : ""}
            </text>
          </g>
        );
      })}
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        className="text-sky-300"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {points.map((h, i) => {
        if (i % arrowEvery !== 0) return null;
        // Hours outside the window were being clamped onto the graph edges.
        if (h.at < t0 || h.at > t0 + horizonH * 3_600_000) return null;
        const x = graphXAt(h.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
        const y = yAt(h.v);
        return <PlotArrow key={h.at} x={x} y={y} deg={h.dirDeg} fill="fill-sky-300" />;
      })}
      {cursorHour ? (
        <PlotArrow
          x={cursorX}
          y={yAt(cursorHour.v)}
          deg={cursorHour.dirDeg}
          fill="fill-sky-200"
          size={1.12}
        />
      ) : null}
      {now >= t0 && now <= tEnd ? (
        <line
          x1={nowX}
          x2={nowX}
          y1={10}
          y2={CUR_H - 22}
          stroke="currentColor"
          className="text-foreground"
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />
      ) : null}
      <line
        x1={cursorX}
        x2={cursorX}
        y1={10}
        y2={CUR_H - 22}
        stroke="currentColor"
        className="text-primary"
        strokeWidth="1.6"
      />
      {axisMarks(t0, horizonH).map((tick) => (
        <text
          key={tick.at}
          x={graphXAt(tick.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R)}
          y={CUR_H - 5}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="9"
        >
          {tick.day ? `${tick.day} ${tick.time}` : tick.time}
        </text>
      ))}
    </svg>
  );
}

function plotU(clientX: number, clientY: number, svg: SVGSVGElement) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return 0.5;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const p = pt.matrixTransform(ctm.inverse());
  const inner = GRAPH_W - PAD_L - PAD_R;
  return Math.max(0, Math.min(1, (p.x - PAD_L) / inner));
}

function svgPoint(ev: PointerEvent<SVGSVGElement>, svg: SVGSVGElement) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  return pt.matrixTransform(ctm.inverse());
}

function panDeltaMs(dxClient: number, svg: SVGSVGElement, horizonH: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm?.a) return 0;
  const inner = GRAPH_W - PAD_L - PAD_R;
  return -((dxClient / ctm.a) / inner) * horizonH * 3_600_000;
}

function pointerToAt(
  ev: PointerEvent<SVGSVGElement>,
  svg: SVGSVGElement,
  t0: number,
  horizonH: number,
): number {
  const ctm = svg.getScreenCTM();
  if (!ctm) return t0;
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  const p = pt.matrixTransform(ctm.inverse());
  const inner = GRAPH_W - PAD_L - PAD_R;
  const u = Math.max(0, Math.min(1, (p.x - PAD_L) / inner));
  return t0 + u * horizonH * 3_600_000;
}

function PlotArrow({
  x,
  y,
  deg,
  fill,
  size = 1,
}: {
  x: number;
  y: number;
  deg: number;
  fill: string;
  size?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${deg}) scale(${size})`}>
      <path
        d="M0 -9 L6.5 8.5 L0 4.2 L-6.5 8.5 Z"
        className={fill}
        stroke="#0b1c24"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </g>
  );
}

function metreTicks(minM: number, maxM: number): number[] {
  const step = maxM - minM > 2.2 ? 0.5 : 0.2;
  const start = Math.floor(minM / step) * step;
  const out: number[] = [];
  for (let v = start; v <= maxM + 0.001; v += step) {
    if (v >= minM - 0.05) out.push(Math.round(v * 10) / 10);
  }
  return out.length ? out : [minM, maxM];
}

function ForecastGraph({
  hours,
  windSeries = [],
  horizonH,
  tideHours,
  tideTurns,
  latDatum,
  layers,
  currentHours,
  waveHours,
  cursorAt,
  onCursor,
  windowStart,
  onPan,
  onZoom,
  height,
  fill,
  lat,
  lng,
}: {
  hours: WxHour[];
  windSeries?: Array<{ id: WindModelId; hours: WxHour[] }>;
  horizonH: number;
  tideHours?: TideHour[];
  tideTurns?: TideTurn[];
  latDatum?: number;
  layers: GraphLayers;
  currentHours?: CurrentHour[];
  waveHours?: WaveHour[];
  cursorAt?: number;
  onCursor?: (at: number) => void;
  windowStart?: number;
  onPan?: (deltaMs: number) => void;
  onZoom?: (nextH: number, anchorAt: number, anchorU: number) => void;
  height?: number;
  fill?: boolean;
  lat?: number;
  lng?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const H = height ?? GRAPH_H;
  const seriesStart = hours[0]?.at ?? Date.now();
  const t0 = windowStart ?? seriesStart;
  const tEnd = t0 + horizonH * 3_600_000;
  const now = Date.now();
  const [localAt, setLocalAt] = useState(() => Math.min(tEnd, Math.max(t0, now)));
  const gesture = useRef<{
    mode: "undecided" | "scrub" | "pan" | "pinch";
    x: number;
    y: number;
    id: number;
  } | null>(null);
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; horizon: number; anchorAt: number; anchorU: number } | null>(
    null,
  );
  const setAt = (n: number) => {
    onCursor?.(n);
    if (cursorAt == null) setLocalAt(n);
  };

  const showWind = layers.wind && hours.length >= 2;
  const showTide = layers.tide && Boolean(tideHours && tideHours.length >= 2);
  const showCurrent = Boolean(layers.current && currentHours && currentHours.length >= 2);
  const showWaves = Boolean(layers.waves && waveHours && waveHours.length >= 2);

  if (!showWind && !showTide && !showCurrent && !showWaves) {
    return <p className="text-sm text-muted-foreground">Turn a layer on.</p>;
  }

  const tidesMsl = tideHours ? windowTide(tideHours, t0, horizonH) : [];
  const datum = latDatum ?? (tidesMsl.length ? latDatumM(tidesMsl) : 0);
  const tides = tidesMsl.map((h) => ({ at: h.at, m: toLatM(h.m, datum) }));
  const tideRng = tides.length >= 2 ? tideRange(tides) : null;
  const waveMax = waveHours?.length ? Math.max(...waveHours.map((h) => h.heightM), 0.5) : 0;
  let minM = 0;
  let maxM = 1;
  if (showTide && tideRng) {
    minM = tideRng.minM;
    maxM = tideRng.maxM;
  }
  if (showWaves) {
    minM = Math.min(minM, 0);
    maxM = Math.max(maxM, waveMax);
  }
  const metreSpan = Math.max(0.2, maxM - minM);
  const range = showTide || showWaves ? { minM, maxM } : null;
  const windMax = graphMaxKn(windSeries.flatMap((s) => s.hours).concat(hours));
  const curMax = currentHours?.length
    ? Math.max(1, Math.ceil(Math.max(...currentHours.map((h) => h.kn), 0.5) * 2) / 2)
    : 1;
  const knMax = showWind ? windMax : curMax;
  const rainMax = Math.max(2, ...hours.map((h) => h.precipMm));
  const innerH = H - PAD_T - PAD_B;
  const yKn = (kn: number) => PAD_T + innerH - (kn / Math.max(1, knMax)) * innerH;
  const yWind = yKn;
  const yTide = (m: number) => PAD_T + innerH - ((m - minM) / metreSpan) * innerH;
  const yWave = yTide;
  const yCurrent = (kn: number) => PAD_T + innerH - (kn / Math.max(0.4, curMax)) * innerH;

  const drawn = [...windSeries]
    .filter((s) => showWind && s.hours.length >= 2)
    .sort((a, b) => WIND_ORDER.indexOf(a.id) - WIND_ORDER.indexOf(b.id));
  const lineOf = (pts: Array<{ at: number; v: number }>) =>
    graphLineTimed(pts, t0, horizonH, GRAPH_W, H, knMax, PAD_L, PAD_R, PAD_T, PAD_B);
  const windPaths = drawn.map((s) => ({
    id: s.id,
    look: WIND_LOOK[s.id],
    wind: lineOf(s.hours.map((h) => ({ at: h.at, v: h.windKn }))),
    gust: lineOf(s.hours.map((h) => ({ at: h.at, v: h.gustKn ?? h.windKn }))),
    warn: gustWarnPath(
      s.hours
        .filter((h) => h.gustKn != null)
        .map((h) => ({ at: h.at, v: h.gustKn as number })),
      (at) => graphXAt(at, t0, horizonH, GRAPH_W, PAD_L, PAD_R),
      yKn,
    ),
  }));
  const arrowSeries = drawn[drawn.length - 1];
  const tideD =
    showTide && range && tides.length >= 2
      ? graphAreaTimed(
          tides.map((h) => ({ at: h.at, v: h.m })),
          t0,
          horizonH,
          GRAPH_W,
          H,
          range.minM,
          range.maxM,
          PAD_L,
          PAD_R,
          PAD_T,
          PAD_B,
        )
      : "";
  const tideLine =
    showTide && range && tides.length >= 2
      ? graphLineTimed(
          tides.map((h) => ({ at: h.at, v: h.m - range.minM })),
          t0,
          horizonH,
          GRAPH_W,
          H,
          Math.max(0.2, range.maxM - range.minM),
          PAD_L,
          PAD_R,
          PAD_T,
          PAD_B,
        )
      : "";
  const waveLine =
    showWaves && range && waveHours && waveHours.length >= 2
      ? graphLineTimed(
          waveHours.map((h) => ({ at: h.at, v: h.heightM - range.minM })),
          t0,
          horizonH,
          GRAPH_W,
          H,
          metreSpan,
          PAD_L,
          PAD_R,
          PAD_T,
          PAD_B,
        )
      : "";
  const currentLine =
    showCurrent && currentHours && currentHours.length >= 2
      ? graphLineTimed(
          currentHours.map((h) => ({ at: h.at, v: h.kn })),
          t0,
          horizonH,
          GRAPH_W,
          H,
          curMax,
          PAD_L,
          PAD_R,
          PAD_T,
          PAD_B,
        )
      : "";

  const turns = (tideTurns ?? [])
    .filter((t) => t.at >= t0 - 20 * 60_000 && t.at <= tEnd + 20 * 60_000)
    .map((t) => ({ ...t, m: toLatM(t.m, datum) }));
  const marks = axisMarks(t0, horizonH);
  const cursor = Math.min(tEnd, Math.max(t0, cursorAt ?? localAt));
  const wx = nearestSample(hours, cursor);
  const tideM = tides.length ? tideAt(tides, cursor) : null;
  const rising = tides.length ? tideRising(tides, cursor) : null;
  const cursorX = graphXAt(cursor, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
  const nowX = graphXAt(now, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
  const nowOn = now >= t0 && now <= tEnd;
  const arrowEvery = horizonH <= 24 ? 3 : horizonH <= 48 ? 4 : 12;
  const owned = cursorAt == null;

  const onDown = (ev: PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    fingers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    try {
      svg.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    if (fingers.current.size >= 2 && onZoom) {
      const pts = [...fingers.current.values()];
      const dist = Math.max(12, Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y));
      const midX = (pts[0]!.x + pts[1]!.x) / 2;
      const midY = (pts[0]!.y + pts[1]!.y) / 2;
      const u = plotU(midX, midY, svg);
      pinch.current = {
        dist,
        horizon: horizonH,
        anchorAt: t0 + u * horizonH * 3_600_000,
        anchorU: u,
      };
      gesture.current = { mode: "pinch", x: midX, y: midY, id: ev.pointerId };
      return;
    }
    const p = svgPoint(ev, svg);
    const onLine = p != null && Math.abs(p.x - cursorX) <= 22;
    gesture.current = {
      mode: onLine || !onPan ? "scrub" : "undecided",
      x: ev.clientX,
      y: ev.clientY,
      id: ev.pointerId,
    };
    if (gesture.current.mode === "scrub") setAt(pointerToAt(ev, svg, t0, horizonH));
  };
  const onMove = (ev: PointerEvent<SVGSVGElement>) => {
    if (fingers.current.has(ev.pointerId)) {
      fingers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    }
    const svg = svgRef.current;
    if (pinch.current && fingers.current.size >= 2 && svg && onZoom) {
      const pts = [...fingers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      if (dist < 12) return;
      onZoom(pinch.current.horizon * (pinch.current.dist / dist), pinch.current.anchorAt, pinch.current.anchorU);
      return;
    }
    const g = gesture.current;
    if (!g || !svg || g.mode === "pinch" || ev.pointerId !== g.id) return;
    const dx = ev.clientX - g.x;
    const dy = ev.clientY - g.y;
    if (g.mode === "undecided") {
      if (Math.hypot(dx, dy) < 8) return;
      g.mode = onPan && Math.abs(dx) >= Math.abs(dy) ? "pan" : "scrub";
      if (g.mode === "scrub") setAt(pointerToAt(ev, svg, t0, horizonH));
    }
    if (g.mode === "scrub") setAt(pointerToAt(ev, svg, t0, horizonH));
    if (g.mode === "pan" && onPan) {
      onPan(panDeltaMs(dx, svg, horizonH));
      g.x = ev.clientX;
      g.y = ev.clientY;
    }
  };
  const onUp = (ev: PointerEvent<SVGSVGElement>) => {
    fingers.current.delete(ev.pointerId);
    const g = gesture.current;
    const svg = svgRef.current;
    if (fingers.current.size < 2) pinch.current = null;
    if (g?.mode === "pinch") {
      if (fingers.current.size === 0) gesture.current = null;
      return;
    }
    gesture.current = null;
    if (g && svg && g.mode === "undecided") setAt(pointerToAt(ev, svg, t0, horizonH));
  };

  return (
    <div className={fill ? "h-full w-full max-w-full" : "w-full max-w-full"}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${GRAPH_W} ${H}`}
        className={fill ? "size-full touch-none" : "h-auto w-full touch-none"}
        preserveAspectRatio={fill ? "none" : "xMidYMid meet"}
        role="img"
        aria-label="Wind and tide graph. Pinch to zoom. Slide sideways to move the window. Tap or drag the line to read a time."
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {lat != null && lng != null ? (
          <NightShade
            lat={lat}
            lng={lng}
            t0={t0}
            horizonH={horizonH}
            height={H}
            padT={PAD_T}
            padB={PAD_B}
          />
        ) : (
          <rect
            x={PAD_L}
            y={PAD_T}
            width={GRAPH_W - PAD_L - PAD_R}
            height={H - PAD_T - PAD_B}
            style={{ fill: "#16324a" }}
          />
        )}
        {tideD ? <path d={tideD} fill="#38bdf8" fillOpacity="0.16" /> : null}
        {showWind || (showCurrent && !showWind)
          ? [knMax, knMax / 2].map((g) => {
              const y = showWind ? yWind(g) : yCurrent(g);
              return (
                <g key={`w${g}`}>
                  <line
                    x1={PAD_L}
                    x2={GRAPH_W - PAD_R}
                    y1={y}
                    y2={y}
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth="1"
                  />
                  <text x="2" y={y + 3} className="fill-muted-foreground" fontSize="9">
                    {g}
                  </text>
                </g>
              );
            })
          : null}
        {range
          ? metreTicks(range.minM, range.maxM).map((m) => {
              const y = yTide(m);
              return (
                <text
                  key={`t${m}`}
                  x={GRAPH_W - 2}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-sky-300"
                  fontSize="8"
                >
                  {m.toFixed(1)}
                </text>
              );
            })
          : null}
        {range ? (
          <text
            x={GRAPH_W - 2}
            y={10}
            textAnchor="end"
            className="fill-sky-300"
            fontSize="8"
          >
            {showTide ? "m LAT" : "m"}
          </text>
        ) : null}
        {showWind || (showCurrent && !showWind) ? (
          <text x="2" y="10" className="fill-muted-foreground" fontSize="8">
            kn
          </text>
        ) : null}
        {showWind
          ? hours.map((h) => {
              if (h.precipMm < 0.1) return null;
              const x = graphXAt(h.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
              const rh = Math.min(18, (h.precipMm / rainMax) * 18);
              return (
                <rect
                  key={`r${h.at}`}
                  x={x - 1.2}
                  y={PAD_T + innerH - rh}
                  width={horizonH > 72 ? 1.2 : 2.6}
                  height={rh}
                  className="fill-sky-400/50"
                />
              );
            })
          : null}
        {windPaths.map((p) =>
          p.wind ? (
            <path
              key={`${p.id}-wind`}
              d={p.wind}
              fill="none"
              stroke="currentColor"
              className={p.look.wind}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null,
        )}
        {tideLine ? (
          <path
            d={tideLine}
            fill="none"
            stroke="currentColor"
            className="text-sky-300"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        ) : null}
        {waveLine ? (
          <path
            d={waveLine}
            fill="none"
            stroke="currentColor"
            className="text-cyan-300"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeDasharray="5 3"
          />
        ) : null}
        {currentLine ? (
          <path
            d={currentLine}
            fill="none"
            stroke="currentColor"
            className="text-amber-300"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        ) : null}
        {showWind && arrowSeries && horizonH <= 72
          ? arrowSeries.hours.map((h, i) => {
              if (i % arrowEvery !== 0) return null;
        // Hours outside the window were being clamped onto the graph edges.
        if (h.at < t0 || h.at > t0 + horizonH * 3_600_000) return null;
              const x = graphXAt(h.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
              const y = yWind(h.windKn);
              return (
                <PlotArrow
                  key={`d${h.at}`}
                  x={x}
                  y={y}
                  deg={h.dirDeg + 180}
                  fill={WIND_LOOK[arrowSeries.id].arrow}
                />
              );
            })
          : null}
        {showWaves && waveHours && horizonH <= 72
          ? waveHours.map((h, i) => {
              if (i % arrowEvery !== 0) return null;
        // Hours outside the window were being clamped onto the graph edges.
        if (h.at < t0 || h.at > t0 + horizonH * 3_600_000) return null;
              const x = graphXAt(h.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
              const y = yWave(h.heightM);
              return (
                <PlotArrow
                  key={`w${h.at}`}
                  x={x}
                  y={y}
                  deg={h.dirDeg + 180}
                  fill="fill-cyan-300"
                />
              );
            })
          : null}
        {showCurrent && currentHours && horizonH <= 72
          ? currentHours.map((h, i) => {
              if (i % arrowEvery !== 0) return null;
        // Hours outside the window were being clamped onto the graph edges.
        if (h.at < t0 || h.at > t0 + horizonH * 3_600_000) return null;
              const x = graphXAt(h.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
              const y = yCurrent(h.kn);
              return (
                <PlotArrow
                  key={`c${h.at}`}
                  x={x}
                  y={y}
                  deg={h.dirDeg}
                  fill="fill-amber-300"
                />
              );
            })
          : null}
        {showTide && range && horizonH <= 96
          ? turns.map((t) => {
              const x = graphXAt(t.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
              const y = yTide(t.m);
              return (
                <g key={`${t.kind}${t.at}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r="2.4"
                    className={t.kind === "high" ? "fill-sky-200" : "fill-sky-500"}
                  />
                  <text
                    x={x}
                    y={Math.max(16, y - 7)}
                    textAnchor="middle"
                    className="fill-sky-200"
                    fontSize="8"
                  >
                    {t.kind === "high" ? `HW ${t.m.toFixed(1)}` : `LW ${t.m.toFixed(1)}`}
                  </text>
                </g>
              );
            })
          : null}
        {showWind && knMax >= GUST_WARN_KN ? (
          <g>
            <line
              x1={PAD_L}
              x2={GRAPH_W - PAD_R}
              y1={yKn(GUST_WARN_KN)}
              y2={yKn(GUST_WARN_KN)}
              stroke="currentColor"
              className="text-destructive/80"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <text x="2" y={yKn(GUST_WARN_KN) + 3} className="fill-destructive" fontSize="9">
              25
            </text>
          </g>
        ) : null}
        {windPaths.map((p) =>
          p.gust ? (
            <path
              key={`${p.id}-gust`}
              d={p.gust}
              fill="none"
              stroke="currentColor"
              className={p.look.gust}
              strokeWidth="1.35"
              strokeDasharray="7 3"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null,
        )}
        {windPaths.map((p) =>
          p.warn ? (
            <path
              key={`${p.id}-warn`}
              d={p.warn}
              fill="none"
              stroke="currentColor"
              className="text-destructive"
              strokeWidth="2.1"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null,
        )}
        {nowOn ? (
          <g>
            <line
              x1={nowX}
              x2={nowX}
              y1={PAD_T}
              y2={H - PAD_B}
              stroke="currentColor"
              className="text-foreground"
              strokeWidth="1.2"
              strokeDasharray="3 3"
            />
            <text x={nowX + 3} y={PAD_T + 9} className="fill-foreground" fontSize="8" fontWeight="600">
              Now
            </text>
          </g>
        ) : null}
        <line
          x1={cursorX}
          x2={cursorX}
          y1={PAD_T}
          y2={H - PAD_B}
          stroke="currentColor"
          className="text-primary"
          strokeWidth="1.7"
        />
        {marks.map((tick) => {
          const x = graphXAt(tick.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
          if (x < PAD_L - 2 || x > GRAPH_W - PAD_R + 2) return null;
          const anchor = x < PAD_L + 26 ? "start" : x > GRAPH_W - PAD_R - 26 ? "end" : "middle";
          const midnight = new Date(tick.at).getHours() === 0;
          return (
            <g key={tick.at}>
              {midnight ? (
                <line
                  x1={x}
                  x2={x}
                  y1={PAD_T}
                  y2={H - PAD_B}
                  stroke="currentColor"
                  className="text-foreground/30"
                  strokeWidth="1"
                />
              ) : null}
              {tick.day ? (
                <text
                  x={x}
                  y={H - 13}
                  textAnchor={anchor}
                  className="fill-foreground"
                  fontSize="9"
                  fontWeight="600"
                >
                  {tick.day}
                </text>
              ) : null}
              {tick.time ? (
                <text
                  x={x}
                  y={H - 2}
                  textAnchor={anchor}
                  className="fill-muted-foreground"
                  fontSize="9"
                >
                  {tick.time}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      {owned ? (
        <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
          <ReadoutCell
            label={dayClock(cursor, now).label}
            value={clockLabel(cursor)}
            hint={dayClock(cursor, now).hint}
          />
          {showWind && wx ? <ReadoutCell {...windGlance(wx)} /> : null}
          {showTide ? (
            <ReadoutCell
              label="Tide LAT"
              value={tideM != null ? formatDepth(tideM) : "—"}
              hint={rising == null ? "Slack" : rising ? "Rising" : "Falling"}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TideNow({
  hours,
  turns,
  t0,
  horizonH,
}: {
  hours: TideHour[];
  turns: TideTurn[];
  t0: number;
  horizonH: number;
}) {
  const now = hours[0];
  if (!now) return null;
  const hw = nextTurn(turns, "high", now.at);
  const lw = nextTurn(turns, "low", now.at);
  const datum = latDatumM(hours);
  const nowLat = toLatM(now.m, datum);
  const hwLat = hw ? toLatM(hw.m, datum) : null;
  const lwLat = lw ? toLatM(lw.m, datum) : null;
  const rise =
    hw ? Math.max(0, Math.round((hw.m - now.m) * 10) / 10) : 0;
  return (
    <div className="mt-3 rounded-md border border-border bg-card/60 px-2.5 py-2">
      <p className="text-t12 text-muted-foreground">
        Tide LAT
      </p>
      <p className="font-display text-2xl leading-none font-semibold tabular-nums">
        {nowLat.toFixed(2)}
        <span className="ml-1 text-xs font-medium text-muted-foreground">m LAT</span>
      </p>
      <p className="mt-1 text-t14 text-muted-foreground">
        {hw
          ? `HW ${hwLat != null ? formatDepth(hwLat) : "—"} ${hourLabel(hw.at)} ${hoursUntil(hw.at)} · ${formatDepth(rise, { signed: true })}`
          : "No high in this window"}
        {lw ? ` · LW ${lwLat != null ? formatDepth(lwLat) : "—"} ${hourLabel(lw.at)}` : ""}
      </p>
    </div>
  );
}

export function AnchorWxCard() {
  useUnitsKey();
  const wx = useWx();
  const draftM = useHelm((s) => s.hull.draftM);
  const [showDelta, setShowDelta] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const data = wx.data;
  if (!data) {
    if (wx.isLoading) {
      return <p className="mb-2 text-xs text-muted-foreground">Loading 24 h wind and tide…</p>;
    }
    if (wx.isError) {
      return (
        <div className="mb-2 rounded-md border border-border bg-background px-3 py-2 text-t14 leading-snug text-muted-foreground">
          No forecast here yet: no signal. Set depth and tide by hand; wind and tide load
          when you're back in range.{" "}
          <button type="button" className="underline" onClick={() => void wx.refetch()}>
            Try again
          </button>
        </div>
      );
    }
    return null;
  }
  const hours = sliceByHorizon(data.hours, 24);
  const maxWind = windowStats(hours).maxWind;
  let maxGust = maxWind;
  let gustSeen = false;
  for (const h of hours) {
    if (h.gustKn == null) continue;
    if (!gustSeen || h.gustKn > (maxGust.gustKn ?? -1)) {
      maxGust = h;
      gustSeen = true;
    }
  }
  const gustKn = gustSeen ? maxGust.gustKn : null;
  const gustWarn = gustKn != null && gustKn >= GUST_WARN_KN;
  const sea = data.sea;
  const riseNow = sea ? tideRiseAt(sea.tideTurns, sea.tideHours, Date.now()) : null;
  const hw = riseNow?.high ?? null;
  const lw = riseNow?.low ?? null;
  const datum =
    sea?.tideOrigin?.kind === "station"
      ? 0
      : (sea?.latDatumM ?? (sea?.tideHours.length ? latDatumM(sea.tideHours) : 0));
  const tideNow = riseNow != null ? toLatM(riseNow.nowM, datum) : null;
  const hwM = hw ? toLatM(hw.m, datum) : null;
  const lwM = lw ? toLatM(lw.m, datum) : null;
  const need = tideNow != null ? chartedDepthNeededM(draftM, tideNow) : null;
  const windModel = WX_MODEL_LABEL[data.source] ?? "Open-Meteo";
  const tideValue = (abs: number | null) => {
    if (abs == null || tideNow == null) return "—";
    if (!showDelta) return formatDepth(abs);
    const d = Math.round((abs - tideNow) * 10) / 10;
    const sign = d > 0 ? "+" : d < 0 ? "−" : "";
    return `${sign}${formatDepth(Math.abs(d))}`;
  };

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <p className="text-t12 text-muted-foreground">
          Next 24 h
          {data.savedAt ? (
            <span className="ml-2 rounded-sm bg-amber-500/20 px-1.5 py-0.5 tracking-normal text-amber-300 normal-case">
              No signal · saved {savedAgo(data.savedAt)}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          aria-label="Where this data comes from"
          aria-expanded={showSource}
          onClick={() => setShowSource((v) => !v)}
          className="flex size-6 items-center justify-center rounded-full border border-border text-t14 leading-none font-semibold text-muted-foreground"
        >
          i
        </button>
      </div>
      {showSource ? (
        <div className="mx-3 mb-2 rounded-md bg-card px-2.5 py-2 text-t13 leading-snug text-muted-foreground">
          <p>Wind and gust: {windModel}, 10 m, via Open-Meteo.</p>
          <p className="mt-1">{tideOriginLabel(sea?.tideOrigin)}</p>
          <p className="mt-1">
            Draw is the draft you set ({formatDepth(draftM)}), not a sounding.
            {need != null
              ? ` Stay in water charted deeper than ${formatDepth(need)}. Not a sounder.`
              : ""}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-[3.4rem_1fr_4.2rem_1.4rem] items-center gap-y-1.5 px-3 pb-2">
        <p className="col-span-4 text-t12 text-muted-foreground">
          Wind · max
        </p>
        <span className="text-t13 text-muted-foreground">Wind</span>
        <span className="font-display text-xl leading-none font-semibold tabular-nums">
          {formatKn(maxWind.windKn)}
          <span className="ml-1 text-t13 font-medium text-muted-foreground">
            kn {windCardinal(maxWind.dirDeg)}
          </span>
        </span>
        <span className="text-right text-xs text-muted-foreground">{hourLabel(maxWind.at)}</span>
        <MiniArrow deg={maxWind.dirDeg + 180} className="justify-self-end text-primary" />
        <span className={gustWarn ? "text-t13 text-destructive" : "text-t13 text-muted-foreground"}>
          Gust
        </span>
        <span
          className={`font-display text-xl leading-none font-semibold tabular-nums ${
            gustWarn ? "text-destructive" : ""
          }`}
        >
          {gustKn != null ? formatKn(gustKn) : "—"}
          {gustKn != null ? (
            <span
              className={`ml-1 text-t13 font-medium ${
                gustWarn ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              kn {windCardinal(maxGust.dirDeg)}
            </span>
          ) : null}
        </span>
        <span
          className={`text-right text-xs ${gustWarn ? "text-destructive" : "text-muted-foreground"}`}
        >
          {gustSeen ? hourLabel(maxGust.at) : ""}
        </span>
        {gustSeen ? (
          <MiniArrow
            deg={maxGust.dirDeg + 180}
            className={`justify-self-end ${gustWarn ? "text-destructive" : "text-primary"}`}
          />
        ) : (
          <span />
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowDelta((v) => !v)}
        aria-pressed={showDelta}
        className="grid w-full grid-cols-[3.4rem_1fr_4.2rem_1.4rem] items-center gap-y-1.5 border-t border-border px-3 py-2 text-left"
      >
        <p className="col-span-4 text-t12 text-muted-foreground">
          {showDelta ? "Tide · change from now" : "Tide · tap for change from now"}
        </p>
        <span className="text-t13 text-muted-foreground">Draw</span>
        <span className="font-display text-xl leading-none font-semibold tabular-nums">
          {draftM.toFixed(1)}
          <span className="ml-1 text-t13 font-medium text-muted-foreground">m</span>
        </span>
        <span className="text-right text-t13 text-muted-foreground">draft</span>
        <span />
        <span className="text-t13 text-muted-foreground">HW</span>
        <span className="font-display text-xl leading-none font-semibold tabular-nums">
          {tideValue(hwM)}
        </span>
        <span className="text-right text-xs text-muted-foreground">{hw ? hourLabel(hw.at) : ""}</span>
        <span />
        <span className="text-t13 text-muted-foreground">LW</span>
        <span className="font-display text-xl leading-none font-semibold tabular-nums">
          {tideValue(lwM)}
        </span>
        <span className="text-right text-xs text-muted-foreground">{lw ? hourLabel(lw.at) : ""}</span>
        <span />
        {showDelta && tideNow != null ? (
          <p className="col-span-4 text-t13 text-muted-foreground">
            Now {tideNow >= 0 ? "+" : "−"}
            {formatDepth(Math.abs(tideNow))} LAT
          </p>
        ) : null}
      </button>
      <Button
        variant="outline"
        size="sm"
        className="mt-1.5 w-full"
        onClick={() => useHelm.getState().setPanel("weather")}
      >
        Full forecast
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-t12 text-muted-foreground">
        {label}
      </p>
      <p className="font-display text-lg leading-none font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
}

export function WindInstrument({ compact }: { compact?: boolean }) {
  const wx = useWx();
  const setPanel = useHelm((s) => s.setPanel);
  const panel = useHelm((s) => s.panel);
  const hour = wx.data?.now;
  const strong = (hour?.windKn ?? 0) >= 22;
  return (
    <button
      type="button"
      onClick={() => setPanel(panel === "weather" ? null : "weather")}
      className={compact ? "min-w-0 flex-1 px-2 py-1.5 text-left" : "min-w-[5.5rem] px-3 py-2 text-left"}
      aria-label="24 hour wind and weather"
    >
      <p className="text-t12 text-muted-foreground">
        Wind
      </p>
      <p
        className={`font-display leading-none font-semibold tabular-nums rp-instrument-value ${
          compact ? "text-lg" : "text-[1.35rem]"
        } ${strong ? "text-destructive" : ""}`}
      >
        {hour ? formatKn(hour.windKn) : wx.isLoading ? "…" : "—"}
        <span className="ml-0.5 text-t12 font-medium text-muted-foreground">
          {hour ? `kn ${windCardinal(hour.dirDeg)}` : "kn"}
        </span>
      </p>
    </button>
  );
}

function savedAgo(at: number): string {
  const h = Math.max(0, Math.round((Date.now() - at) / 3_600_000));
  if (h < 1) return "just now";
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
