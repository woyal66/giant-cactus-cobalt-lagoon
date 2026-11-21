/**
 * Everything else an offline pack saves besides the satellite photos: seabed depth tiles
 * (depth shading, too-shallow, spot depth), the Chart map, and the weather grid for the area.
 * Each part is best effort: a missing part leaves that feature online-only.
 */
import { CHART_GLYPHS, CHART_TILES } from "./chart-style.ts";
import { saveChartArea } from "./chart-cache.ts";
import { DEPTH_MAX_Z, loadDemTile } from "./depth.ts";
import { tileRange, type BBox } from "./offline-tiles.ts";
import { saveAreaWeather } from "./wx-map-data.ts";

export type ExtrasResult = { depthTiles: number; chartTiles: number; weather: boolean };

export async function saveRegionExtras(b: BBox, onStep?: (label: string) => void, signal?: AbortSignal): Promise<ExtrasResult> {
  onStep?.("Seabed depth");
  let depthTiles = 0;
  for (let z = 8; z <= Math.min(12, DEPTH_MAX_Z); z++) {
    const r = tileRange(b, z);
    for (let x = r.x0; x <= r.x1; x++) {
      for (let y = r.y0; y <= r.y1; y++) {
        if (signal?.aborted) return { depthTiles, chartTiles: 0, weather: false };
        if (await loadDemTile(z, x, y)) depthTiles++;
      }
    }
  }
  onStep?.("Chart map");
  const chartTiles = await saveChartArea(b, `${CHART_TILES}`, CHART_GLYPHS, undefined, signal).catch(() => 0);
  onStep?.("Weather (3 days)");
  // The weather grid covers a wider area so the layers still fill the screen when zoomed out.
  const pad = 0.5;
  const weather = await saveAreaWeather({ south: b.south - pad, west: b.west - pad, north: b.north + pad, east: b.east + pad }).catch(() => false);
  return { depthTiles, chartTiles, weather };
}
