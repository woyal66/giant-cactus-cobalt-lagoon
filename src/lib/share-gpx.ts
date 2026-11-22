import { gpxFileName, toGpx } from "@/lib/gpx";
import type { Waypoint } from "@/lib/passages";
import { shareTextFile } from "@/lib/share-file";

/** Phone: share sheet. Browser: download. */
export function shareGpx(name: string, points: Waypoint[]): Promise<void> {
  return shareTextFile({
    fileName: gpxFileName(name),
    text: toGpx(name, points),
    mime: "application/gpx+xml",
    title: "Export track",
  });
}
