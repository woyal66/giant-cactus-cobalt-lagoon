import { useRef } from "react";
import {
  gpsStationLabel,
  stationFromTap,
} from "@/lib/boat";
import { UnitStepField } from "@/components/helm/unit-field";
import { Sheet } from "@/components/helm/panels";
import { useHelm } from "@/store/helm";
import { BoatTypePicker } from "@/components/helm/boat-type";





function BoatPlan() {
  const hull = useHelm((s) => s.hull);
  const setHull = useHelm((s) => s.setHull);
  const type = useHelm((s) => s.routePrefs.boatType);
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
        aria-label={`Bird's-eye ${type === "motor" ? "motor boat" : type === "catamaran" ? "catamaran" : "sailboat"}. Tap to mark the GPS.`}
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
        {type === "catamaran" ? (
          <>
            <path className="rp-plan-hull" d="M28 24 C33 40 36 70 36 110 L36 204 L20 204 L20 110 C20 70 23 40 28 24 Z" />
            <path className="rp-plan-hull" d="M72 24 C77 40 80 70 80 110 L80 204 L64 204 L64 110 C64 70 67 40 72 24 Z" />
            <rect className="rp-plan-deck" x="30" y="78" width="40" height="92" rx="4" />
            <rect className="rp-plan-cabin" x="36" y="84" width="28" height="40" rx="3" />
            <rect className="rp-plan-cockpit" x="38" y="130" width="24" height="34" rx="2" />
            <circle className="rp-plan-mast" cx="50" cy="80" r="3.2" />
          </>
        ) : type === "motor" ? (
          <>
            <path className="rp-plan-hull" d="M50 22 C62 38 69 62 70 96 L70 204 L30 204 L30 96 C31 62 38 38 50 22 Z" />
            <path className="rp-plan-deck" d="M50 40 C58 52 62 70 62 96 L62 196 L38 196 L38 96 C38 70 42 52 50 40 Z" />
            <rect className="rp-plan-cabin" x="40" y="88" width="20" height="44" rx="3" />
            <rect className="rp-plan-cockpit" x="40" y="140" width="20" height="50" rx="2" />
          </>
        ) : (
          <>
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
          </>
        )}
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
    <Sheet
      id="boat"
      title="Boat"
      kicker="Hull and GPS"
      help="Chain is measured from the bow roller. If the phone sits in the aft cabin, mark where it lives below, or the anchor and alarm circle sit 10–15 m off."
    >
      <div className="mb-2">
        <p className="mb-1 text-t12 text-muted-foreground">Type</p>
        <BoatTypePicker />
      </div>
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
