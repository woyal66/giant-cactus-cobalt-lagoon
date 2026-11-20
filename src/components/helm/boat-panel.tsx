import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  gpsStationLabel,
  stationFromTap,
} from "@/lib/boat";
import { useHelm, type PanelId } from "@/store/helm";

function Sheet({
  id,
  title,
  kicker,
  children,
}: {
  id: NonNullable<PanelId>;
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  const panel = useHelm((s) => s.panel);
  const setPanel = useHelm((s) => s.setPanel);
  if (panel !== id) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 md:inset-y-20 md:right-3 md:bottom-24 md:left-auto md:w-[22rem]">
      <div className="pointer-events-auto max-h-[min(58vh,32rem)] overflow-y-auto rounded-t-xl border border-border bg-card px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border)] md:max-h-[min(72vh,36rem)] md:rounded-xl md:p-4">
        <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-border md:hidden" />
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            {kicker ? (
              <p className="text-[9px] tracking-[0.14em] text-muted-foreground uppercase">
                {kicker}
              </p>
            ) : null}
            <h2 className="font-display text-xl leading-none font-semibold tracking-tight">
              {title}
            </h2>
          </div>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setPanel(null)}>
            Close
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

function roundStep(n: number, step: number) {
  const s = step || 1;
  return Math.round(n / s) * s;
}

function formatStep(n: number, step: number) {
  if (step < 1) return n.toFixed(1);
  return String(Math.round(n * 10) / 10);
}

function StepField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-2 py-1.5">
      <p className="text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(Math.max(0, roundStep(value - step, step)))}
          aria-label={`Decrease ${label}`}
        >
          −
        </Button>
        <p className="font-display flex-1 text-center text-xl font-semibold tabular-nums">
          {formatStep(value, step)}
        </p>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(roundStep(value + step, step))}
          aria-label={`Increase ${label}`}
        >
          +
        </Button>
      </div>
    </div>
  );
}

function BoatPlan() {
  const hull = useHelm((s) => s.hull);
  const setHull = useHelm((s) => s.setHull);
  const svgRef = useRef<SVGSVGElement>(null);

  const mark = (clientX: number, clientY: number) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setHull(stationFromTap(clientX - r.left, clientY - r.top, r.width, r.height, hull));
  };

  const gx = Math.max(
    12,
    Math.min(88, 50 + (hull.gpsFromCenterM / Math.max(0.4, hull.beamM)) * 100),
  );
  const gy = Math.max(
    10,
    Math.min(210, (hull.gpsFromBowM / Math.max(1, hull.loaM)) * 220),
  );

  return (
    <div className="rounded-lg border border-border bg-background p-2">
      <p className="mb-1 text-[9px] tracking-[0.12em] text-muted-foreground uppercase">
        Tap where the phone lives
      </p>
      <svg
        ref={svgRef}
        viewBox="0 0 100 220"
        className="rp-plan mx-auto block h-52 w-full touch-none"
        role="img"
        aria-label="Bird's-eye sailboat. Tap to mark the GPS."
        data-testid="boat-plan"
        onPointerDown={(e) => {
          (e.currentTarget as SVGSVGElement).setPointerCapture?.(e.pointerId);
          mark(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0 && e.pressure === 0) return;
          mark(e.clientX, e.clientY);
        }}
      >
        <title>Plan view — bow at the top</title>
        <text
          x="50"
          y="14"
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 8, letterSpacing: 1.4 }}
        >
          BOW
        </text>
        <text
          x="8"
          y="118"
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 7, letterSpacing: 0.8 }}
          transform="rotate(-90 8 118)"
        >
          PORT
        </text>
        <text
          x="92"
          y="118"
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 7, letterSpacing: 0.8 }}
          transform="rotate(90 92 118)"
        >
          STBD
        </text>
        <path
          className="rp-plan-hull"
          d="M50 22 C58 36 66 58 68 92 L70 148 C70 168 64 186 50 204 C36 186 30 168 30 148 L32 92 C34 58 42 36 50 22 Z"
        />
        <path
          className="rp-plan-deck"
          d="M50 40 C56 50 60 68 61 92 L62 140 C62 154 58 168 50 180 C42 168 38 154 38 140 L39 92 C40 68 44 50 50 40 Z"
        />
        <rect className="rp-plan-cabin" x="42" y="78" width="16" height="30" rx="3" />
        <rect className="rp-plan-cockpit" x="43" y="114" width="14" height="32" rx="2" />
        <rect className="rp-plan-cabin" x="42" y="154" width="16" height="30" rx="3" />
        <circle className="rp-plan-mast" cx="50" cy="72" r="3.2" />
        <line className="rp-plan-center" x1="50" y1="28" x2="50" y2="198" />
        <circle className="rp-plan-gps" cx={gx} cy={gy} r="6.5" />
        <circle className="rp-plan-gps-core" cx={gx} cy={gy} r="2.6" />
        <text
          x="50"
          y="216"
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 8, letterSpacing: 1.4 }}
        >
          STERN
        </text>
      </svg>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        Alarm {gpsStationLabel(hull)}
      </p>
    </div>
  );
}

export function BoatPanel() {
  const hull = useHelm((s) => s.hull);
  const setHull = useHelm((s) => s.setHull);

  return (
    <Sheet id="boat" title="Boat" kicker="Hull and GPS">
      <p className="mb-2 text-xs text-pretty text-muted-foreground">
        Chain is from the bow roller. If the phone sits in the aft cabin, mark it
        or the hook and alarm sit 10–15 m off.
      </p>
      <div className="mb-2 grid grid-cols-2 gap-2">
        <StepField
          label="Length m"
          value={hull.loaM}
          step={0.5}
          onChange={(n) => setHull({ loaM: n })}
        />
        <StepField
          label="Draft m"
          value={hull.draftM}
          step={0.1}
          onChange={(n) => setHull({ draftM: n })}
        />
        <StepField
          label="Beam m"
          value={hull.beamM}
          step={0.1}
          onChange={(n) => setHull({ beamM: n })}
        />
        <StepField
          label="Bow roller m"
          value={hull.bowM}
          step={0.1}
          onChange={(n) => setHull({ bowM: n })}
        />
      </div>
      <BoatPlan />
    </Sheet>
  );
}
