/**
 * Shared anchorages and places kept on the phone, so they still show out of signal. Whatever
 * the chart loads online is remembered, and an offline pack saves everything in its area.
 */
import { anchoragesInView, type SharedAnchorage } from "./anchorage-library.ts";
import { kvGet, kvSet } from "./kv.ts";
import { placesInView, type SharedPlace } from "./place-library.ts";

type Box = { s: number; w: number; n: number; e: number };
type Kind = "anchorages" | "places";
type Item = { id: string; lat: number; lng: number };

const MAX = 8000;
const key = (k: Kind) => `lib:cache:${k}`;
const mem = new Map<Kind, Map<string, Item>>();

async function load(k: Kind): Promise<Map<string, Item>> {
  const hit = mem.get(k);
  if (hit) return hit;
  const list = (await kvGet<Item[]>(key(k)).catch(() => undefined)) ?? [];
  const m = new Map(list.map((x) => [x.id, x]));
  mem.set(k, m);
  return m;
}

let saveTimer = 0;
function saveSoon(k: Kind) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const m = mem.get(k);
    if (m) void kvSet(key(k), [...m.values()].slice(-MAX)).catch(() => undefined);
  }, 1500);
}

/** Remember what was loaded online. Rows gone from the server for this box are dropped. */
export async function remember(k: Kind, box: Box, items: Item[], full = true) {
  const m = await load(k);
  if (full) for (const [id, x] of m) if (inBox(x, box) && !items.some((i) => i.id === id)) m.delete(id);
  for (const x of items) {
    m.delete(x.id);
    m.set(x.id, x);
  }
  while (m.size > MAX) m.delete(m.keys().next().value!);
  if (typeof window !== "undefined") saveSoon(k);
  else await kvSet(key(k), [...m.values()]);
}

export async function forget(k: Kind, id: string) {
  const m = await load(k);
  if (m.delete(id) && typeof window !== "undefined") saveSoon(k);
}

const inBox = (x: Item, b: Box) => x.lat >= b.s && x.lat <= b.n && x.lng >= b.w && x.lng <= b.e;

export async function cachedInView<T extends Item>(k: Kind, b: Box): Promise<T[]> {
  const m = await load(k);
  return [...m.values()].filter((x) => inBox(x, b)) as T[];
}

/** Split a box into cells of at most `step` degrees (the server returns a few hundred per query). */
export function cells(b: Box, step = 0.25): Box[] {
  const out: Box[] = [];
  for (let s = b.s; s < b.n; s += step) for (let w = b.w; w < b.e; w += step) out.push({ s, w, n: Math.min(b.n, s + step), e: Math.min(b.e, w + step) });
  return out;
}

/** For an offline pack: fetch every shared anchorage and place in the area. Best effort. */
export async function saveLibraryArea(b: { south: number; west: number; north: number; east: number }, signal?: AbortSignal): Promise<number> {
  let n = 0;
  const parts = cells({ s: b.south, w: b.west, n: b.north, e: b.east }).slice(0, 80);
  for (const c of parts) {
    if (signal?.aborted) break;
    const [a, p] = await Promise.all([
      anchoragesInView(c).catch(() => null as SharedAnchorage[] | null),
      placesInView(c).catch(() => null as SharedPlace[] | null),
    ]);
    if (a) {
      await remember("anchorages", c, a);
      n += a.length;
    }
    if (p) {
      await remember("places", c, p);
      n += p.length;
    }
  }
  return n;
}
