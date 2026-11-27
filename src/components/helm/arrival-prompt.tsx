import { useEffect, useState } from "react";
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
  // Arrival counts only once the boat has been well clear of the last mark on this track, so
  // loading a track at its far end (where "Follow reversed" is offered) doesn't say "arrived".
  const [away, setAway] = useState<string | null>(null);
  const last = passage?.waypoints[passage.waypoints.length - 1];
  const key = passage ? `${"localId" in passage ? passage.localId : passage.title}` : null;
  const distM = boat && last ? haversineMeters(boat, last) : null;
  useEffect(() => {
    if (key && distM != null && distM > ARRIVED_M * 2 && away !== key) setAway(key);
  }, [key, distM, away]);
  if (!passage || !boat || panel || anchor) return null;
  if (!last || passage.waypoints.length < 2 || done === key || away !== key || distM == null || distM > ARRIVED_M) return null;
  const stop = () => {
    setDone(key);
    useHelm.getState().setActivePassage(null);
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))+4.4rem)] z-[46] flex justify-center px-2">
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
