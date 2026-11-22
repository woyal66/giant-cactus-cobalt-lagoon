import { Button } from "@/components/ui/button";
import { BOAT_TYPES, type BoatType } from "@/lib/routing/polar";
import { useHelm } from "@/store/helm";

/** Monohull / Catamaran / Motor boat. Switching to or from motor sets a sensible cruising speed. */
export function BoatTypePicker() {
  const type = useHelm((s) => s.routePrefs.boatType);
  const choose = (id: BoatType) => {
    const s = useHelm.getState();
    const kn = s.routePrefs.motorKn;
    const motorKn = id === "motor" && kn <= 8 ? 15 : id !== "motor" && kn > 10 ? 6 : kn;
    s.setRoutePrefs({ boatType: id, motorKn });
  };
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Boat type">
      {BOAT_TYPES.map((b) => (
        <Button key={b.id} size="sm" role="radio" aria-checked={type === b.id} variant={type === b.id ? "default" : "outline"} onClick={() => choose(b.id)}>
          {b.label}
        </Button>
      ))}
    </div>
  );
}
