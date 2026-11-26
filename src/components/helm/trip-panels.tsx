import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/helm/panels";
import { Button } from "@/components/ui/button";
import { formatMeters } from "@/lib/geo";
import { kvDel, kvGet } from "@/lib/kv";
import { formatDuration } from "@/lib/measure";
import { shareImageFile, shareTextFile } from "@/lib/share-file";
import { speedColor, speedSeries, tripCsv, tripGpx, type TripFix } from "@/lib/trip";
import { tripKey } from "@/hooks/trip-recorder";
import { useHelm, useUnitsKey, type TripRecord } from "@/store/helm";
import { tripLine } from "@/components/helm/trip-format";

const clock = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
const day = (at: number) => new Date(at).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const hm = (ms: number) => formatDuration(ms / 3_600_000);
const kn = (v: number) => `${v.toFixed(1)} kn`;
const late = (min: number) => (Math.abs(min) < 1 ? "on time" : min > 0 ? `${min} min late` : `${-min} min early`);


function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-2.5 py-2">
      <p className="text-t12 text-muted-foreground">{label}</p>
      <p className="font-display text-t16 leading-tight font-semibold tabular-nums">{value}</p>
      {note ? <p className="text-t12 leading-snug text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** The trip summary: times, distance, speeds, plan against actual, speed graph, exports. */
export function TripSummaryPanel() {
  useUnitsKey();
  const id = useHelm((s) => s.tripView);
  const trip = useHelm((s) => s.trips.find((t) => t.id === s.tripView) ?? null);
  const shown = useHelm((s) => s.tripTrack?.id === s.tripView);
  const [fixes, setFixes] = useState<TripFix[] | null>(null);
  useEffect(() => {
    setFixes(null);
    if (!id) return;
    let live = true;
    void kvGet<TripFix[]>(tripKey(id)).then((f) => {
      if (live) setFixes(f ?? []);
    });
    return () => {
      live = false;
    };
  }, [id]);
  const series = useMemo(() => (fixes ? speedSeries(fixes) : []), [fixes]);
  if (!trip) return null;
  const s = trip.stats;
  const p = s.plan;

  const show = () => {
    if (!series.length) return;
    useHelm.setState({ tripTrack: { id: trip.id, topKn: Math.max(s.topKn, 1), series }, tripCursor: null, followBoat: false });
    const lats = series.map((x) => x.lat);
    const lngs = series.map((x) => x.lng);
    const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const spanM = Math.max((Math.max(...lats) - Math.min(...lats)) * 111_320, (Math.max(...lngs) - Math.min(...lngs)) * 111_320 * Math.cos((lat * Math.PI) / 180), 300);
    useHelm.getState().fly(lat, lng, Math.max(8, Math.min(17, Math.floor(Math.log2((156_543 * Math.cos((lat * Math.PI) / 180) * 300) / spanM)))));
  };

  return (
    <Sheet id="trip" title={trip.title} kicker={`Trip on ${day(s.departAt)}`}>
      <p className="mb-2 text-t14 text-muted-foreground">
        {day(s.departAt)} · left {clock(s.departAt)}, arrived {clock(s.arriveAt)}
        {trip.anchoredAt ? " · anchored" : ""}
      </p>
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <Stat label="Distance" value={formatMeters(s.distM)} note={`${formatMeters(s.straightM)} in a straight line`} />
        <Stat label="Time" value={hm(s.arriveAt - s.departAt)} note={`${hm(s.movingMs)} moving · ${hm(s.stoppedMs)} stopped`} />
        <Stat label="Average speed" value={kn(s.avgMovingKn)} note={`${kn(s.avgKn)} including stops`} />
        <Stat label="Top speed" value={kn(s.topKn)} note={`Held 30 s · peak ${kn(s.peakKn)}`} />
        {s.engineMs > 60_000 ? <Stat label="Engine" value={hm(s.engineMs)} note="From the Engine on switch" /> : null}
      </div>

      {p ? (
        <div className="mb-2 rounded-lg border border-primary/50 px-2.5 py-2">
          <p className="text-t14 font-semibold">Against the plan{trip.plan ? `: ${trip.plan.title}` : ""}</p>
          <ul className="mt-1 grid gap-0.5 text-t14">
            <li>
              Left {clock(s.departAt)} (planned {clock(trip.plan!.departAt)}): <span className="font-semibold">{late(p.departLateMin)}</span>
            </li>
            <li>
              Arrived {clock(s.arriveAt)} (planned {clock(trip.plan!.arriveAt)}): <span className="font-semibold">{late(p.arriveLateMin)}</span>
            </li>
            <li>
              Passage time {hm(s.arriveAt - s.departAt)} against {hm(p.plannedMs)} planned
            </li>
            <li>
              Sailed {formatMeters(s.distM)} against {formatMeters(p.plannedDistM)} planned · within 100 m of the plan {p.onRoutePct}% of the time · furthest off {formatMeters(p.maxOffM)}
            </li>
          </ul>
          {p.checkpoints.length >= 2 ? (
            <div className="mt-1.5">
              <p className="text-t12 text-muted-foreground">Along the way (against the planned time there)</p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {p.checkpoints.map((c, i) => (
                  <span
                    key={i}
                    className={`rounded px-1.5 py-0.5 text-t12 font-semibold tabular-nums ${c.lateMin > 5 ? "bg-amber-400/20 text-amber-200" : c.lateMin < -5 ? "bg-primary/20 text-primary" : "bg-foreground/10"}`}
                  >
                    {clock(c.actualAt)} {c.lateMin > 0 ? `+${c.lateMin}` : c.lateMin} min
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {series.length >= 3 ? <SpeedGraph series={series} topKn={Math.max(s.topKn, s.avgMovingKn, 1)} /> : fixes ? null : <p className="text-t13 text-muted-foreground">Loading the track…</p>}

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Button className="col-span-2" disabled={!series.length} onClick={shown ? () => useHelm.setState({ tripTrack: null, tripCursor: null }) : show}>
          {shown ? "Hide the speed track" : "Show on the chart, coloured by speed"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!fixes?.length}
          onClick={() => {
            void shareTextFile({ fileName: `${slug(trip.title)}.gpx`, text: tripGpx(trip.title, fixes!), mime: "application/gpx+xml", title: trip.title }).catch((e: unknown) => {
              if (!/cancel/i.test(String(e))) toast.error("Couldn't export the trip");
            });
          }}
        >
          GPX with times
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!fixes?.length}
          onClick={() => {
            void shareTextFile({ fileName: `${slug(trip.title)}.csv`, text: tripCsv(fixes!), mime: "text/csv", title: trip.title }).catch((e: unknown) => {
              if (!/cancel/i.test(String(e))) toast.error("Couldn't export the trip");
            });
          }}
        >
          Log (CSV)
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="col-span-2"
          disabled={!series.length}
          onClick={() => {
            void tripPicture(trip, series)
              .then((blob) => (blob ? shareImageFile({ fileName: `${slug(trip.title)}.png`, blob, title: trip.title, text: `${trip.title}: ${tripLine(s)}` }) : undefined))
              .catch((e: unknown) => {
                if (!/cancel/i.test(String(e))) toast.error("Couldn't make the picture");
              });
          }}
        >
          Share a picture of the trip
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="col-span-2 text-destructive"
          onClick={() => {
            if (!window.confirm(`Delete the trip "${trip.title}"? The recorded track (if any) stays in My tracks.`)) return;
            const st = useHelm.getState();
            useHelm.setState({
              trips: st.trips.filter((t) => t.id !== trip.id),
              tripView: null,
              panel: null,
              tripTrack: st.tripTrack?.id === trip.id ? null : st.tripTrack,
            });
            void kvDel(tripKey(trip.id));
          }}
        >
          Delete this trip
        </Button>
      </div>
    </Sheet>
  );
}

function slug(s: string): string {
  return s.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "trip";
}

/** Speed over time; drag along it to see where the boat was on the chart. */
function SpeedGraph({ series, topKn }: { series: Array<{ at: number; kn: number; lat: number; lng: number }>; topKn: number }) {
  const svg = useRef<SVGSVGElement>(null);
  const [cur, setCur] = useState<number | null>(null);
  const W = 320;
  const H = 110;
  const max = Math.ceil(topKn * 1.1);
  const x = (i: number) => (i / (series.length - 1)) * W;
  const y = (v: number) => H - (Math.min(v, max) / max) * (H - 12) - 2;
  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return;
    const i = Math.max(0, Math.min(series.length - 1, Math.round(((e.clientX - r.left) / r.width) * (series.length - 1))));
    setCur(i);
    const p = series[i]!;
    useHelm.setState({ tripCursor: { lat: p.lat, lng: p.lng } });
  };
  const c = cur != null ? series[cur]! : null;
  return (
    <div className="rounded-lg border border-border bg-background px-2 py-1.5">
      <div className="flex items-baseline justify-between text-t13">
        <span className="text-muted-foreground">Speed through the trip</span>
        <span className="font-semibold tabular-nums">{c ? `${clock(c.at)} · ${kn(c.kn)}` : "Drag along the graph"}</span>
      </div>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 h-28 w-full touch-none"
        role="img"
        aria-label="Speed over the trip"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons || e.pointerType === "touch") pick(e);
        }}
        onPointerUp={() => {
          setCur(null);
          useHelm.setState({ tripCursor: null });
        }}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" strokeOpacity={0.12} />
        ))}
        {series.slice(1).map((p, i) => (
          <line key={i} x1={x(i)} y1={y(series[i]!.kn)} x2={x(i + 1)} y2={y(p.kn)} stroke={speedColor(p.kn, topKn)} strokeWidth={2.5} strokeLinecap="round" />
        ))}
        <text x={2} y={10} fontSize={10} fill="currentColor" opacity={0.7}>
          {max} kn
        </text>
        {cur != null ? <line x1={x(cur)} x2={x(cur)} y1={0} y2={H} stroke="currentColor" strokeWidth={1.5} /> : null}
      </svg>
    </div>
  );
}

/** A picture of the trip for sharing: the track coloured by speed and the main numbers. */
async function tripPicture(trip: TripRecord, series: Array<{ kn: number; lat: number; lng: number }>): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#0b1f26";
  g.fillRect(0, 0, W, H);
  const s = trip.stats;
  // Track, fitted into the top of the card.
  const box = { x: 80, y: 220, w: W - 160, h: 640 };
  const lats = series.map((p) => p.lat);
  const lngs = series.map((p) => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const spanX = Math.max(1e-6, (Math.max(...lngs) - Math.min(...lngs)) * kx);
  const spanY = Math.max(1e-6, Math.max(...lats) - Math.min(...lats));
  const k = Math.min(box.w / spanX, box.h / spanY);
  const ox = box.x + (box.w - spanX * k) / 2;
  const oy = box.y + (box.h - spanY * k) / 2;
  const px = (p: { lat: number; lng: number }) => [ox + (p.lng - Math.min(...lngs)) * kx * k, oy + (Math.max(...lats) - p.lat) * k] as const;
  g.lineCap = "round";
  g.lineJoin = "round";
  for (let i = 1; i < series.length; i++) {
    const [x1, y1] = px(series[i - 1]!);
    const [x2, y2] = px(series[i]!);
    g.strokeStyle = speedColor(series[i]!.kn, Math.max(s.topKn, 1));
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  }
  const font = (size: number, weight = 600) => `${weight} ${size}px "Atkinson Hyperlegible Next", system-ui, sans-serif`;
  g.fillStyle = "#e8fff8";
  g.font = font(64);
  g.fillText(trip.title.slice(0, 28), 80, 120);
  g.font = font(38, 400);
  g.fillStyle = "#a8c5c9";
  g.fillText(`${day(s.departAt)} · ${clock(s.departAt)} to ${clock(s.arriveAt)}`, 80, 178);
  const cells: Array<[string, string]> = [
    ["Distance", formatMeters(s.distM)],
    ["Time", hm(s.arriveAt - s.departAt)],
    ["Average", kn(s.avgMovingKn)],
    ["Top speed", kn(s.topKn)],
  ];
  cells.forEach(([label, value], i) => {
    const x = 80 + (i % 2) * 470;
    const y = 960 + Math.floor(i / 2) * 170;
    g.fillStyle = "#a8c5c9";
    g.font = font(36, 400);
    g.fillText(label, x, y);
    g.fillStyle = "#3ee0c0";
    g.font = font(72);
    g.fillText(value, x, y + 80);
  });
  g.fillStyle = "#6f8f94";
  g.font = font(30, 400);
  g.fillText("Anchor Mate", 80, H - 50);
  return new Promise((res) => c.toBlob(res, "image/png"));
}
