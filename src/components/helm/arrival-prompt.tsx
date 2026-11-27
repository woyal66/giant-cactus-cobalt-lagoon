import { useState } from "react";
import { Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unlockAlarmAudio } from "@/hooks/helm-runtime";
import { haversineMeters } from "@/lib/geo";
import { useHelm } from "@/store/helm";

/** Within this of the last mark counts as arrived. */
const ARRIVED_M = 25;

/**
 * At the end of a followed track: "You've arrived" with the next step, setting the anchor here
 * (which also ends the trip log) or just stopping the guidance. Shown once per track.
 */
export function ArrivalPrompt() {
  const passage = useHelm((s) => s.activePassage);
  const boat = useHelm((s) => s.boat);
  const panel = useHelm((s) => s.panel);
  const anchor = useHelm((s) => s.anchor);
  const [done, setDone] = useState<string | null>(null);
  if (!passage || !boat || panel || anchor) return null;
  const last = passage.waypoints[passage.waypoints.length - 1];
  const key = `${"localId" in passage ? passage.localId : passage.title}`;
  if (!last || passage.waypoints.length < 2 || done === key || haversineMeters(boat, last) > ARRIVED_M) return null;
  const stop = () => {
    setDone(key);
    useHelm.getState().setActivePassage(null);
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))+4.4rem)] z-30 flex justify-center px-2">
      <div className="pointer-events-auto w-full max-w-md rounded-xl border border-primary/60 bg-card p-3 shadow-[var(--shadow-border)] rp-glass" role="status">
        <p className="text-t16 font-semibold">You've arrived: end of {passage.title}</p>
        <p className="text-t13 text-muted-foreground">Check the depth and swing room, then set the anchor. The track stays saved to lead you out again (Reverse).</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Button
            className="col-span-2"
            onClick={() => {
              stop();
              unlockAlarmAudio();
              useHelm.getState().beginAnchorSet();
            }}
          >
            <Anchor className="size-4" />
            Set anchor here
          </Button>
          <Button variant="outline" onClick={stop}>
            Stop
          </Button>
        </div>
        <Button variant="ghost" size="sm" className="mt-1 w-full" onClick={() => setDone(key)}>
          Keep following
        </Button>
      </div>
    </div>
  );
}
