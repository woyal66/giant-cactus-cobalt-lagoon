import { useMemo, useState, type ReactNode } from "react";
import { GLOSSARY, compassPoint, motorHeading, pointOfSail, seaState } from "@/lib/routing/explain";
import { Moon, Sun } from "lucide-react";
import { isDaylight } from "@/lib/sun";
import { formatDepth } from "@/lib/units";
import { apparentWind, describe, sailPlan, type SailDef } from "@/lib/routing/sails";
import type { RoutePoint } from "@/lib/routing/router";
import { RISK_LABEL } from "@/lib/routing/storm";
import { useHelm } from "@/store/helm";

const W = 340;
const L = 30;
const R = 6;
const BANDS = { speed: [8, 78], angle: [92, 152], sea: [166, 202], storm: [214, 224], sails: [236, 252] } as const;
const HEIGHT = 258;

type Sample = RoutePoint & { aws: number; awa: number; day: boolean };

function clock(at: number, withDay = false): string {
  const d = new Date(at);
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return withDay ? `${d.toLocaleDateString([], { weekday: "short" })} ${t}` : t;
}

/**
 * Wind graph for a planned route: true and apparent wind speed and angle, seas and
 * current, storm risk and the sail plan along the way. Drag across it to read any
 * moment; the boat marker follows on the chart.
 */
export function RouteTimeline({
  points,
  sails,
  maxWindKn,
  motorBoat = false,
}: {
  points: RoutePoint[];
  sails: SailDef[];
  maxWindKn: number;
  /** Motor boat: no apparent wind or sail plan; the graph ends at the storm band. */
  motorBoat?: boolean;
}) {
  const setCursor = useHelm((s) => s.setRouteCursor);
  const [idx, setIdx] = useState(0);

  const samples: Sample[] = useMemo(
    () =>
      points.slice(0, -1).map((p) => {
        const a = apparentWind(p.twsKn, p.twa, p.stwKn);
        return { ...p, aws: a.aws, awa: a.awa, day: isDaylight(p.lat, p.lng, p.at) };
      }),
    [points],
  );
  const plan = useMemo(() => (motorBoat ? { segments: [], changes: [] } : sailPlan(points, sails)), [points, sails, motorBoat]);
  const height = motorBoat ? BANDS.storm[1] + 14 : HEIGHT;
  const bottom = motorBoat ? BANDS.storm[1] : BANDS.sails[1];
  if (samples.length < 2) return null;

  const t0 = points[0]!.at;
  const t1 = points[points.length - 1]!.at;
  const x = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const top = Math.max(maxWindKn + 5, ...samples.map((s) => Math.max(s.gustKn, motorBoat ? 0 : s.aws)));
  const ySpeed = (kn: number) => BANDS.speed[1] - (kn / top) * (BANDS.speed[1] - BANDS.speed[0]);
  const yAngle = (deg: number) => BANDS.angle[0] + (deg / 180) * (BANDS.angle[1] - BANDS.angle[0]);
  const waveTop = Math.max(1, ...samples.map((s) => s.waveM));
  const seaMid = (BANDS.sea[0] + BANDS.sea[1]) / 2;
  const yCur = (kn: number) => seaMid - (Math.max(-2, Math.min(2, kn)) / 2) * ((BANDS.sea[1] - BANDS.sea[0]) / 2);
  const line = (f: (s: Sample) => number) => samples.map((s, i) => `${i ? "L" : "M"}${x(s.at).toFixed(1)},${f(s).toFixed(1)}`).join(" ");
  const gustArea =
    `M${x(samples[0]!.at)},${ySpeed(samples[0]!.twsKn)} ` +
    samples.map((s) => `L${x(s.at).toFixed(1)},${ySpeed(s.gustKn).toFixed(1)}`).join(" ") +
    ` L${x(samples[samples.length - 1]!.at)},${ySpeed(samples[samples.length - 1]!.twsKn)} ` +
    [...samples].reverse().map((s) => `L${x(s.at).toFixed(1)},${ySpeed(s.twsKn).toFixed(1)}`).join(" ") +
    " Z";
  const cur = samples[Math.min(idx, samples.length - 1)]!;
  const segAt = plan.segments.find((g) => cur.at >= g.from && cur.at < g.to) ?? plan.segments[plan.segments.length - 1];

  const scrub = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    const t = t0 + ((vx - L) / (W - L - R)) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < samples.length; i += 1) {
      if (Math.abs(samples[i]!.at - t) < Math.abs(samples[best]!.at - t)) best = i;
    }
    setIdx(best);
    setCursor({ lat: samples[best]!.lat, lng: samples[best]!.lng });
  };
  const ticks: number[] = [];
  const stepH = (t1 - t0) / 3_600_000 > 30 ? 12 : (t1 - t0) / 3_600_000 > 12 ? 6 : (t1 - t0) / 3_600_000 > 5 ? 2 : 1;
  for (let t = Math.ceil(t0 / (stepH * 3_600_000)) * stepH * 3_600_000; t < t1; t += stepH * 3_600_000) ticks.push(t);

  return (
    <div className="mt-2">
      <p className="mb-6 text-t13 text-muted-foreground">Drag along the graph: the numbers follow your finger and the boat moves on the chart.</p>
      <div className="relative">
      {/* Bubble that follows the finger, so the reading stays in view while dragging. */}
      <div
        className="pointer-events-none absolute top-0 z-10 rounded-md bg-card/95 px-2 py-1 text-t13 leading-tight font-semibold tabular-nums shadow-[var(--shadow-border)]"
        style={{ left: `${Math.max(14, Math.min(86, (x(cur.at) / W) * 100))}%`, transform: "translate(-50%, -100%)" }}
      >
        <span className="block text-center">{clock(cur.at, true)}</span>
        <span className="block text-center font-normal">
          {Math.round(cur.twsKn)} kn {compassPoint(cur.windDir)} · boat {(cur.sogKn ?? cur.stwKn).toFixed(1)} kn
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={motorBoat ? "Wind, wind angle, sea and storm along the route. Drag to read a moment." : "Wind, angle, sea, storm and sail plan along the route. Drag to read a moment."}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          scrub(e.clientX, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === "touch") scrub(e.clientX, e.currentTarget);
        }}
      >
        {/* night shading */}
        {samples.map((s, i) => {
          if (s.day) return null;
          const next = samples[i + 1]?.at ?? t1;
          return <rect key={`n${i}`} x={x(s.at)} y={0} width={Math.max(0.5, x(next) - x(s.at))} height={height} className="fill-foreground/[0.06]" />;
        })}

        {/* speed band */}
        <text x={2} y={BANDS.speed[0] + 8} className="fill-muted-foreground text-t11">kn</text>
        {[0, 10, 20, 30, 40].filter((v) => v <= top).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={ySpeed(v)} y2={ySpeed(v)} className="stroke-border" strokeWidth={0.5} />
            <text x={L - 3} y={ySpeed(v) + 3} textAnchor="end" className="fill-muted-foreground text-t11">{v}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={ySpeed(maxWindKn)} y2={ySpeed(maxWindKn)} className="stroke-destructive" strokeDasharray="3 3" strokeWidth={0.8} />
        <path d={gustArea} className="fill-primary/20" />
        <path d={line((s) => ySpeed(s.twsKn))} className="stroke-primary" fill="none" strokeWidth={1.8} />
        {motorBoat ? null : <path d={line((s) => ySpeed(s.aws))} className="stroke-foreground" fill="none" strokeWidth={1.2} strokeDasharray="4 2" />}

        {/* angle band with points of sail */}
        <rect x={L} y={yAngle(0)} width={W - L - R} height={yAngle(55) - yAngle(0)} className="fill-amber-400/10" />
        <rect x={L} y={yAngle(55)} width={W - L - R} height={yAngle(135) - yAngle(55)} className="fill-emerald-400/10" />
        <rect x={L} y={yAngle(135)} width={W - L - R} height={yAngle(180) - yAngle(135)} className="fill-sky-400/10" />
        {[0, 90, 180].map((v) => (
          <text key={v} x={L - 3} y={yAngle(v) + 3} textAnchor="end" className="fill-muted-foreground text-t11">{v}°</text>
        ))}
        <text x={L + 2} y={yAngle(28)} className="fill-muted-foreground text-t11">{motorBoat ? "head wind" : "upwind"}</text>
        <text x={L + 2} y={yAngle(95)} className="fill-muted-foreground text-t11">{motorBoat ? "beam" : "reach"}</text>
        <text x={L + 2} y={yAngle(160)} className="fill-muted-foreground text-t11">{motorBoat ? "behind" : "downwind"}</text>
        <path d={line((s) => yAngle(s.twa))} className="stroke-primary" fill="none" strokeWidth={1.8} />
        {motorBoat ? null : <path d={line((s) => yAngle(s.awa))} className="stroke-foreground" fill="none" strokeWidth={1.2} strokeDasharray="4 2" />}

        {/* sea + current */}
        <text x={L - 3} y={BANDS.sea[0] + 6} textAnchor="end" className="fill-muted-foreground text-t11">sea</text>
        {samples.map((s, i) => {
          const next = samples[i + 1]?.at ?? t1;
          const h = (s.waveM / waveTop) * (BANDS.sea[1] - BANDS.sea[0]);
          return (
            <rect
              key={`w${i}`}
              x={x(s.at)}
              y={BANDS.sea[1] - h}
              width={Math.max(0.8, x(next) - x(s.at) - 0.5)}
              height={h}
              className={s.waveAmp >= 1.15 ? "fill-destructive/50" : "fill-sky-400/40"}
            />
          );
        })}
        <line x1={L} x2={W - R} y1={seaMid} y2={seaMid} className="stroke-border" strokeWidth={0.5} />
        <path d={line((s) => yCur(s.curAlongKn))} className="stroke-violet-300" fill="none" strokeWidth={1.2} />

        {/* storm */}
        <text x={L - 3} y={BANDS.storm[1]} textAnchor="end" className="fill-muted-foreground text-t11">storm</text>
        {samples.map((s, i) => {
          const next = samples[i + 1]?.at ?? t1;
          const cls =
            s.thunder >= 3 ? "fill-destructive" : s.thunder === 2 ? "fill-orange-400" : s.thunder === 1 ? "fill-amber-300/70" : s.squall ? "fill-violet-400" : "fill-muted";
          return <rect key={`s${i}`} x={x(s.at)} y={BANDS.storm[0]} width={Math.max(0.8, x(next) - x(s.at))} height={BANDS.storm[1] - BANDS.storm[0]} className={cls} />;
        })}

        {/* sails */}
        {motorBoat ? null : <text x={L - 3} y={BANDS.sails[1] - 4} textAnchor="end" className="fill-muted-foreground text-t11">sails</text>}
        {plan.segments.map((g, i) => {
          const w = x(g.to) - x(g.from);
          return (
            <g key={`g${i}`}>
              <rect x={x(g.from)} y={BANDS.sails[0]} width={Math.max(0.8, w - 1)} height={BANDS.sails[1] - BANDS.sails[0]} rx={2} className={g.motoring ? "fill-muted" : i % 2 ? "fill-primary/30" : "fill-primary/50"} />
              {w > 40 ? (
                <text x={x(g.from) + 3} y={BANDS.sails[1] - 5} className="fill-foreground text-t11">
                  {g.motoring ? "Engine" : `${g.main.replace("Main ", "").replace("Full main", "Full")} ${g.head.replace("Asymmetric spinnaker", "Asym").replace("Symmetric spinnaker", "Spin").replace("Genoa furled ~70%", "Genoa 70%")}`}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* time axis + cursor */}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={height - 0.5} textAnchor="middle" className="fill-muted-foreground text-t11">{clock(t)}</text>
        ))}
        <line x1={x(cur.at)} x2={x(cur.at)} y1={0} y2={bottom} className="stroke-amber-300" strokeWidth={1} />
      </svg>
      </div>
      <Readout cur={cur} sails={segAt ? describe(segAt) : null} motorBoat={motorBoat} />
      <p className="mt-1 text-t12 text-muted-foreground">
        {motorBoat ? "Line: wind" : "Solid: true wind · dashed: apparent wind"} · red bars: seas raised by wind over tide · green line: tide (+ fair) · shaded: night
      </p>

      {plan.changes.length ? (
        <div className="mt-2">
          <p className="mb-1 text-t12 text-muted-foreground">Sail plan</p>
          <ul className="grid gap-0.5 text-t14 tabular-nums">
            {plan.changes.map((c) => {
              const p = samples.find((s) => s.at >= c.at) ?? samples[samples.length - 1]!;
              return (
                <li key={c.at} className="flex items-center gap-2">
                  {p.day ? <Sun className="size-3.5 text-amber-300" aria-label="day" /> : <Moon className="size-3.5 text-sky-300" aria-label="night" />}
                  <span className="w-20 shrink-0 text-muted-foreground">{clock(c.at, c.at - t0 > 20 * 3_600_000)}</span>
                  <span>{c.text}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, note, full = false }: { label: string; value: ReactNode; note?: string; full?: boolean }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-2 py-0.5">
      <p className="text-t13 text-muted-foreground">{label}</p>
      <div>
        <p className="text-t15 leading-snug">{value}</p>
        {note && full ? <p className="text-t13 leading-snug text-muted-foreground">{note}</p> : null}
      </div>
    </div>
  );
}

/** The moment under the slider, in plain words. */
function Readout({ cur, sails, motorBoat }: { cur: Sample; sails: string | null; motorBoat: boolean }) {
  const [help, setHelp] = useState(false);
  const side = cur.tack > 0 ? "starboard (right)" : cur.tack < 0 ? "port (left)" : "";
  const pos = motorBoat ? motorHeading(cur.twa) : pointOfSail(cur.twa, cur.motoring);
  const sea = seaState(cur.waveM);
  const sog = cur.sogKn ?? cur.stwKn;
  const tide = cur.curAlongKn;
  const cruiseKn = useHelm((s) => s.routePrefs.motorKn);
  const slowed = motorBoat && cur.stwKn < cruiseKn * 0.92 ? ` Slowed from your ${cruiseKn} kn cruise by the sea.` : "";
  return (
    <div className="mt-2 mb-2 tabular-nums">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-t16 font-semibold">
          {clock(cur.at, true)}
          {cur.day ? "" : " · night"}
        </p>
        <button type="button" onClick={() => setHelp((h) => !h)} className="text-t13 text-primary underline" aria-expanded={help}>
          {help ? "Less detail" : "More detail"}
        </button>
      </div>
      <Row
        full={help}
        label="Wind"
        value={
          <>
            <b>{Math.round(cur.twsKn)} kn</b> from the {compassPoint(cur.windDir)}, gusts {Math.round(cur.gustKn)} kn
          </>
        }
      />
      {motorBoat ? (
        <Row full={help} label="Wind angle" value={`${pos.name}, ${Math.round(cur.twa)}° off the bow`} note={pos.feel} />
      ) : (
        <>
          <Row
        full={help}
            label="On the boat"
            value={
              <>
                <b>{Math.round(cur.aws)} kn</b> at {Math.round(cur.awa)}° {side ? `on the ${side}` : "off the bow"}
              </>
            }
            note="Apparent wind: what you feel and set the sails to."
          />
          <Row full={help} label="Point of sail" value={pos.name} note={pos.feel} />
        </>
      )}
      <Row
        full={help}
        label="Boat speed"
        value={
          <>
            <b>{sog.toFixed(1)} kn</b> over the ground{cur.motoring && !motorBoat ? " (engine)" : ""}
          </>
        }
        note={
          Math.abs(tide) >= 0.1
            ? `Current ${tide > 0 ? "helping" : "against you"} by ${Math.abs(tide).toFixed(1)} kn (${cur.stwKn.toFixed(1)} kn through the water).${slowed}`
            : `${cur.stwKn.toFixed(1)} kn through the water, no real current.${slowed}`
        }
      />
      <Row
        full={help}
        label="Seas"
        value={
          <>
            <b>{formatDepth(cur.waveM)}</b> · {sea.name}
          </>
        }
        note={`${sea.feel}${cur.waveAmp >= 1.15 ? `. Wind over tide makes them about ${Math.round((cur.waveAmp - 1) * 100)}% higher and steeper here.` : "."}`}
      />
      <Row
        full={help}
        label="Storms"
        value={`${RISK_LABEL[cur.thunder]}${cur.squall ? ", squalls likely" : ""}`}
        note={cur.thunder >= 2 || cur.squall ? (motorBoat ? "Watch the sky; head for shelter early." : "Reef early and watch the sky.") : undefined}
      />
      {sails && !motorBoat ? <Row full={help} label="Sails" value={sails} /> : null}
      {help ? (
        <dl className="mt-2 grid gap-1 border-t border-border pt-2">
          {GLOSSARY.filter(([k]) => !motorBoat || k !== "Apparent wind").map(([k, v]) => (
            <div key={k}>
              <dt className="text-t14 font-semibold">{k}</dt>
              <dd className="text-t13 leading-snug text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
