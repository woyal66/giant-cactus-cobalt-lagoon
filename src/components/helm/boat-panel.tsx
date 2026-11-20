import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  gpsStationLabel,
  stationFromTap,
} from "@/lib/boat";
import { UnitStepField } from "@/components/helm/unit-field";
import { useHelm, useUnitsKey, type PanelId } from "@/store/helm";

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
  useUnitsKey();
  if (panel !== id) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 md:inset-y-20 md:right-3 md:bottom-24 md:left-auto md:w-[22rem]">
      <div className="pointer-events-auto max-h-[min(58vh,32rem)] overflow-y-auto rounded-t-xl border border-border bg-card px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border)] md:max-h-[min(72vh,36rem)] md:rounded-xl md:p-4">
        <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-border md:hidden" />
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            {kicker ? (
              <p className="text-t12 text-muted-foreground">
                {kicker}
              </p>
            ) : null}
            <h2 className="font-display text-xl leading-none font-semibold tracking-tight">
              {title}
            </h2>
          </div>
          <Button variant="outline" size="sm" className="h-10 min-w-16 px-3" onClick={() => setPanel(null)}>
            Close
          </Button>
        </div>
        {children}
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
      <p className="mb-1 text-t12 text-muted-foreground">
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
        <UnitStepField
          label="Length"
          kind="length"
          valueM={hull.loaM}
          steps={{ m: 0.5, ft: 1 }}
          onChange={(n) => setHull({ loaM: n })}
        />
        <UnitStepField
          label="Draft"
          kind="depth"
          valueM={hull.draftM}
          steps={{ m: 0.1, ft: 0.5, fm: 0.1 }}
          onChange={(n) => setHull({ draftM: n })}
        />
        <UnitStepField
          label="Beam"
          kind="length"
          valueM={hull.beamM}
          steps={{ m: 0.1, ft: 0.5 }}
          onChange={(n) => setHull({ beamM: n })}
        />
        <UnitStepField
          label="Bow roller"
          kind="length"
          valueM={hull.bowM}
          steps={{ m: 0.1, ft: 0.5 }}
          onChange={(n) => setHull({ bowM: n })}
        />
      </div>
      <BoatPlan />
    </Sheet>
  );
}
