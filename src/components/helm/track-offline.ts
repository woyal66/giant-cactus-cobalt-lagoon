import { toast } from "sonner";
import type { LatLng } from "@/lib/geo";
import { downloadPack, formatBytes, estimatePack, listPacks, trackBox, trackPackZoom } from "@/lib/offline-tiles";
import { useHelm } from "@/store/helm";

let running = false;

/** How much a track's area would take, for the label on the switch (null: too big to save). */
export function trackAreaSize(pts: LatLng[]): { zoom: number; text: string } | null {
  const box = trackBox(pts);
  const zoom = box ? trackPackZoom(box) : null;
  if (!box || zoom == null) return null;
  return { zoom, text: `about ${formatBytes(estimatePack(box, zoom).bytes)}` };
}

/**
 * Save the water round a track for offline in one go: satellite photos at the finest detail
 * that fits (full detail on a reef-sized track), then seabed depth, the Chart map, tides and
 * weather, the same as an offline pack. Progress shows in one message at the top.
 */
export async function saveTrackOffline(pts: LatLng[], name: string): Promise<boolean> {
  const box = trackBox(pts);
  const zoom = box ? trackPackZoom(box) : null;
  if (!box || zoom == null) {
    toast.warning("This track covers too much water for one offline area. Save the reef ends from Map → Offline areas.");
    return false;
  }
  if (running) {
    toast("An offline area is already downloading.");
    return false;
  }
  running = true;
  const id = "track-offline";
  toast.loading(`Saving ${name} for offline: photos…`, { id, duration: Infinity });
  try {
    const pack = await downloadPack(box, zoom, name, (p) => {
      toast.loading(`Saving ${name} for offline: photos ${Math.round((100 * p.done) / Math.max(1, p.total))}%`, { id, duration: Infinity });
    });
    const { saveRegionExtras } = await import("@/lib/region-pack");
    const extras = await saveRegionExtras(box, (step) => toast.loading(`Saving ${name} for offline: ${step.toLowerCase()}…`, { id, duration: Infinity }));
    useHelm.getState().setOfflinePacks(await listPacks());
    const missing = [extras.depthTiles ? null : "seabed", extras.chartTiles ? null : "chart map", extras.weather ? null : "weather"].filter(Boolean);
    if (pack.missing) toast.warning(`${name} saved with ${pack.missing} photo tiles missing. Save again with a better signal to fill the gaps.`, { id, duration: 8000 });
    else if (missing.length) toast.warning(`${name} saved for offline, but not the ${missing.join(", ")}: those need a signal.`, { id, duration: 8000 });
    else toast.success(`${name} is on this phone: photos, seabed, chart, tides and weather`, { id, duration: 6000 });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Download stopped";
    if (msg === "cancelled" || /AbortError/.test(String(err))) toast.dismiss(id);
    else toast.error(`Couldn't save the area: ${msg}`, { id, duration: 8000 });
    return false;
  } finally {
    running = false;
  }
}
