/**
 * Offline Chart map: MapLibre loads its tile description, vector tiles and fonts through the
 * "cached://" scheme. Each answer comes from the phone when saved, else from the network (and
 * is kept), so a region you've viewed or saved in a pack works with no signal.
 */
import { putTile, readTile, tileRange, type BBox } from "./offline-tiles.ts";

export const CACHED = "cached://";

const key = (url: string) => `chart/${url}`;

async function getCached(url: string, signal?: AbortSignal): Promise<Blob | null> {
  const hit = await readTile(key(url));
  if (hit) return hit;
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    const blob = await r.blob();
    void putTile(key(url), blob).catch(() => undefined);
    return blob;
  } catch {
    return null;
  }
}

let registered = false;

/** Register the cached:// scheme with MapLibre (once). */
export function registerChartCache(maplibre: { addProtocol: (name: string, fn: (p: { url: string; type?: string }, a: AbortController) => Promise<{ data: unknown }>) => void }) {
  if (registered) return;
  registered = true;
  maplibre.addProtocol("cached", async (params, abort) => {
    const url = params.url.slice(CACHED.length);
    const blob = await getCached(url, abort.signal);
    if (!blob) {
      // An empty vector tile draws nothing; a missing description or font fails as normal.
      if (params.type === "arrayBuffer") return { data: new ArrayBuffer(0) };
      throw new Error(`Not available offline: ${url}`);
    }
    if (params.type === "json") {
      const json = JSON.parse(await blob.text()) as { tiles?: string[] };
      if (Array.isArray(json.tiles)) json.tiles = json.tiles.map((t) => CACHED + t);
      return { data: json };
    }
    return { data: await blob.arrayBuffer() };
  });
}

/** Tile URL template from the TileJSON (fetched or saved). */
export async function chartTileTemplate(tileJsonUrl: string): Promise<{ template: string; maxzoom: number } | null> {
  const blob = await getCached(tileJsonUrl);
  if (!blob) return null;
  try {
    const json = JSON.parse(await blob.text()) as { tiles?: string[]; maxzoom?: number };
    return json.tiles?.[0] ? { template: json.tiles[0], maxzoom: json.maxzoom ?? 14 } : null;
  } catch {
    return null;
  }
}

/** Save the Chart map for an area (vector tiles up to z14, plus the common fonts). */
export async function saveChartArea(
  b: BBox,
  tileJsonUrl: string,
  glyphs: string,
  onTile?: () => void,
  signal?: AbortSignal,
): Promise<number> {
  const tj = await chartTileTemplate(tileJsonUrl);
  if (!tj) return 0;
  const urls: string[] = [];
  for (let z = 6; z <= Math.min(14, tj.maxzoom); z++) {
    const r = tileRange(b, z);
    for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) urls.push(tj.template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)));
  }
  for (const font of ["Noto Sans Regular", "Noto Sans Bold"]) {
    for (const range of ["0-255", "256-511", "8192-8447"]) {
      urls.push(glyphs.replace("{fontstack}", encodeURIComponent(font)).replace("{range}", range));
    }
  }
  let n = 0;
  for (const u of urls) {
    if (signal?.aborted) break;
    if (await getCached(u, signal)) n++;
    onTile?.();
  }
  return n;
}
