import { formatMeters } from "@/lib/geo";
import { formatDuration } from "@/lib/measure";
import type { TripStats } from "@/lib/trip";

/** One line for lists: distance, time and average speed. */
export function tripLine(s: TripStats): string {
  return `${formatMeters(s.distM)} · ${formatDuration((s.arriveAt - s.departAt) / 3_600_000)} · ${s.avgMovingKn.toFixed(1)} kn avg`;
}
