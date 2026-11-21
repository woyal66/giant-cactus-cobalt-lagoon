import { useEffect, useRef } from "react";
import {
  nearestSample,
  stormRiskOf,
  windCardinal,
  windColor,
  windSeaM,
  WIND_SCALE_STEPS,
  type CurrentHour,
  type WaveHour,
  type WxHour,
} from "@/lib/weather";
import { formatDepth } from "@/lib/units";

const RISK_TEXT = ["", "⚡", "⚡⚡", "⚡⚡⚡"];
const RISK_CLASS = ["", "text-amber-300", "text-orange-400", "text-red-400"];

/**
 * Hour-by-hour table, scrolled sideways: wind and gust coloured by strength, rain, cloud,
 * temperature, storm risk, waves split into swell and wind sea, tide and current.
 * Tapping a column moves the graph cursor there.
 */
export function WeatherTable({
  hours,
  waveHours,
  currentHours,
  tideAt,
  windowStart,
  horizonH,
  cursorAt,
  onCursor,
}: {
  hours: WxHour[];
  waveHours: WaveHour[];
  currentHours: CurrentHour[];
  tideAt: ((at: number) => number | null) | null;
  windowStart: number;
  horizonH: number;
  cursorAt: number;
  onCursor: (at: number) => void;
}) {
  const stepH = horizonH <= 24 ? 1 : horizonH <= 72 ? 3 : 6;
  const end = windowStart + horizonH * 3_600_000;
  const cols = hours.filter((h, i) => h.at >= windowStart - 1 && h.at <= end && (i === 0 || new Date(h.at).getHours() % stepH === 0));
  const cursorCol = cols.reduce<WxHour | null>((b, h) => (!b || Math.abs(h.at - cursorAt) < Math.abs(b.at - cursorAt) ? h : b), null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll only the table sideways; scrollIntoView would also scroll the whole forecast page.
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>("[data-cursor=true]");
    if (box && el) box.scrollLeft = Math.max(0, el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2);
  }, [cursorCol?.at]);
  if (!cols.length) return null;
  const hasWaves = waveHours.length > 0;
  const hasCurrent = currentHours.length > 0;
  const hasSwell = waveHours.some((w) => w.swellM != null);
  const anyStorm = cols.some((h) => stormRiskOf(h) > 0);
  const label = "sticky left-0 z-10 bg-card pr-1.5 text-left text-t12 font-medium text-muted-foreground";
  const cell = "px-0 py-0.5 text-center tabular-nums";
  type Row = { name: string; render: (h: WxHour) => React.ReactNode; cls?: (h: WxHour) => string; style?: (h: WxHour) => React.CSSProperties };
  const wave = (h: WxHour) => nearestSample(waveHours, h.at);
  const rows: Row[] = [
    {
      name: "Wind",
      render: (h) => (
        <span className="inline-flex flex-col items-center leading-none">
          <span aria-hidden style={{ transform: `rotate(${h.dirDeg + 180}deg)` }} className="inline-block text-t13">
            ↑
          </span>
          <span className="text-t11 opacity-80">{windCardinal(h.dirDeg)}</span>
        </span>
      ),
    },
    {
      name: "kn",
      render: (h) => Math.round(h.windKn),
      style: (h) => ({ background: windColor(h.windKn).bg, color: windColor(h.windKn).fg }),
      cls: () => "font-semibold",
    },
    {
      name: "Gust",
      render: (h) => (h.gustKn != null ? Math.round(h.gustKn) : "—"),
      style: (h) => (h.gustKn != null ? { background: windColor(h.gustKn).bg, color: windColor(h.gustKn).fg } : {}),
    },
    {
      name: "Rain",
      render: (h) => (h.precipMm >= 0.1 ? h.precipMm.toFixed(h.precipMm < 10 ? 1 : 0) : ""),
      style: (h) => (h.precipMm >= 0.1 ? { background: `rgba(56,152,236,${Math.min(0.85, 0.2 + h.precipMm / 8)})` } : {}),
    },
    ...(anyStorm
      ? [{ name: "Storm", render: (h: WxHour) => RISK_TEXT[stormRiskOf(h)], cls: (h: WxHour) => RISK_CLASS[stormRiskOf(h)] }]
      : []),
    { name: "Cloud", render: (h) => `${h.cloudPct}`, cls: () => "text-muted-foreground" },
    { name: "°C", render: (h) => Math.round(h.tempC) },
    ...(hasWaves
      ? [
          {
            name: "Sea",
            render: (h: WxHour) => {
              const w = wave(h);
              return w ? formatDepth(w.heightM, { unit: undefined }).replace(/\s.*$/, "") : "";
            },
            cls: () => "font-semibold text-cyan-200",
          },
          ...(hasSwell
            ? [
                {
                  name: "Swell",
                  render: (h: WxHour) => {
                    const w = wave(h);
                    return w?.swellM != null ? formatDepth(w.swellM).replace(/\s.*$/, "") : "";
                  },
                  cls: () => "text-cyan-300/90",
                },
                {
                  name: "Wind sea",
                  render: (h: WxHour) => {
                    const w = wave(h);
                    return w ? formatDepth(windSeaM(w.heightM, w.swellM)).replace(/\s.*$/, "") : "";
                  },
                  cls: () => "text-cyan-300/90",
                },
              ]
            : []),
          {
            name: "Period",
            render: (h: WxHour) => {
              const w = wave(h);
              return w?.periodS ? `${Math.round(w.periodS)}s` : "";
            },
            cls: () => "text-muted-foreground",
          },
        ]
      : []),
    ...(tideAt
      ? [
          {
            name: "Tide",
            render: (h: WxHour) => {
              const m = tideAt(h.at);
              return m == null ? "" : formatDepth(m).replace(/\s.*$/, "");
            },
            cls: () => "text-sky-200",
          },
        ]
      : []),
    ...(hasCurrent
      ? [
          {
            name: "Current",
            render: (h: WxHour) => {
              const c = nearestSample(currentHours, h.at);
              return c ? (
                <span className="inline-flex flex-col items-center leading-none">
                  <span aria-hidden style={{ transform: `rotate(${c.dirDeg}deg)` }} className="inline-block text-t13">
                    ↑
                  </span>
                  <span className="text-t11">{c.kn.toFixed(1)}</span>
                </span>
              ) : (
                ""
              );
            },
            cls: () => "text-violet-300",
          },
        ]
      : []),
  ];
  const unitNote = formatDepth(1).replace(/^[\d.,\s]+/, "");

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border bg-card">
      <div ref={scroller} className="overflow-x-auto overscroll-x-contain">
        <table className="border-separate border-spacing-x-px border-spacing-y-0 text-t13">
          <thead>
            <tr>
              <th className={label} />
              {cols.map((h, i) => {
                const d = new Date(h.at);
                const newDay = i === 0 || d.getHours() < stepH;
                return (
                  <th
                    key={h.at}
                    data-cursor={h.at === cursorCol?.at}
                    onClick={() => onCursor(h.at)}
                    className={`min-w-[2.15rem] cursor-pointer px-0 pt-1 text-center font-medium tabular-nums ${h.at === cursorCol?.at ? "bg-primary/25" : ""}`}
                  >
                    <span className="block text-t11 text-muted-foreground">
                      {newDay ? d.toLocaleDateString([], { weekday: "short" }) : " "}
                    </span>
                    {d.toLocaleTimeString([], { hour: "numeric" }).replace(/\s?([AP])M/i, (_, x: string) => x.toLowerCase())}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <th scope="row" className={label}>
                  {r.name}
                </th>
                {cols.map((h) => (
                  <td
                    key={h.at}
                    onClick={() => onCursor(h.at)}
                    style={r.style?.(h)}
                    className={`${cell} ${r.cls?.(h) ?? ""} ${h.at === cursorCol?.at && !r.style ? "bg-primary/15" : ""}`}
                  >
                    {r.render(h)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1 text-t11 text-muted-foreground">
        <span>kn</span>
        {WIND_SCALE_STEPS.map((s, i) => (
          <span key={s.bg} className="flex items-center gap-0.5">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: s.bg }} />
            {i < WIND_SCALE_STEPS.length - 1 ? s.upTo : ""}
          </span>
        ))}
        <span className="ml-auto">Seas, tide in {unitNote || "m"}</span>
      </div>
    </div>
  );
}
