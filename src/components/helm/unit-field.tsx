import { Button } from "@/components/ui/button";
import { useHelm } from "@/store/helm";
import {
  depthSuffix,
  fromDepth,
  fromLength,
  lengthSuffix,
  toDepth,
  toLength,
  type DepthUnit,
  type LengthUnit,
} from "@/lib/units";

type Steps = { m: number; ft: number; fm?: number };

/**
 * A − value + field that shows and steps in the skipper's units but always hands
 * back metres. `kind` picks the depth unit (m/ft/fm) or the length unit (m/ft).
 */
export function UnitStepField({
  label,
  kind,
  valueM,
  steps,
  onChange,
}: {
  label: string;
  kind: "depth" | "length";
  valueM: number;
  steps: Steps;
  onChange: (metres: number) => void;
}) {
  const depthUnit = useHelm((s) => s.depthUnit);
  const lengthUnit = useHelm((s) => s.lengthUnit);
  const unit: DepthUnit | LengthUnit = kind === "depth" ? depthUnit : lengthUnit;
  const step = unit === "fm" ? (steps.fm ?? 0.5) : unit === "ft" ? steps.ft : steps.m;
  const toUnit = (m: number) => (kind === "depth" ? toDepth(m, depthUnit) : toLength(m, lengthUnit));
  const toM = (v: number) => (kind === "depth" ? fromDepth(v, depthUnit) : fromLength(v, lengthUnit));
  const suffix = kind === "depth" ? depthSuffix(depthUnit) : lengthSuffix(lengthUnit);
  const shown = toUnit(valueM);
  const places = step < 1 ? 1 : 0;
  const snap = (v: number) => Math.max(0, Math.round(v / step) * step);

  return (
    <div className="rounded-lg border border-border bg-background px-2 py-1.5">
      <p className="text-t12 text-muted-foreground">
        {label} {suffix}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(toM(snap(shown - step)))}
          aria-label={`Decrease ${label}`}
        >
          −
        </Button>
        <p className="font-display flex-1 text-center text-xl font-semibold tabular-nums">
          {shown.toFixed(places)}
        </p>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onChange(toM(snap(shown + step)))}
          aria-label={`Increase ${label}`}
        >
          +
        </Button>
      </div>
    </div>
  );
}
