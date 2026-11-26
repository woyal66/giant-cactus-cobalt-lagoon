/**
 * Channel finder: the deepest clear way between two points through shallow water, on a fine
 * grid of the depth model (about 30 m on the Great Barrier Reef). Water shallower than the
 * boat's limit, and land, is blocked; water shallower than a comfortable depth (5 m or the
 * limit + 2 m) costs more, so the path keeps to channels and deep water where it can.
 *
 * Pure (A* on a grid, then line-of-sight smoothing), so it is tested. The worker fills the grid.
 */
import type { LatLng } from "../geo.ts";

export type DepthGrid = {
  south: number;
  west: number;
  north: number;
  east: number;
  nx: number;
  ny: number;
  /** Water depth below mean sea level per cell, metres (+ = water); NaN = no data. */
  depth: Float32Array;
  /** 1 = land or mapped reef from the outlines. */
  land: Uint8Array;
};

export type ChannelOpts = {
  /** Block water shallower than this (m, mean sea level). */
  minDepthM: number;
  /** Prefer water at least this deep. */
  comfortM?: number;
  /** How strongly to prefer deep water (extra cost per metre in the shallowest allowed water). */
  shallowPenalty?: number;
};

function cellOf(g: DepthGrid, p: LatLng): [number, number] {
  const ix = Math.floor(((p.lng - g.west) / (g.east - g.west)) * g.nx);
  const iy = Math.floor(((p.lat - g.south) / (g.north - g.south)) * g.ny);
  return [Math.max(0, Math.min(g.nx - 1, ix)), Math.max(0, Math.min(g.ny - 1, iy))];
}

function centre(g: DepthGrid, ix: number, iy: number): LatLng {
  return {
    lat: g.south + ((iy + 0.5) / g.ny) * (g.north - g.south),
    lng: g.west + ((ix + 0.5) / g.nx) * (g.east - g.west),
  };
}

/** Whether a cell can be sailed: water at least minDepthM deep (no data counts as water). */
export function passable(g: DepthGrid, k: number, minDepthM: number): boolean {
  if (g.land[k]) return false;
  const d = g.depth[k]!;
  return !Number.isFinite(d) || d >= minDepthM;
}

/** Cells along a straight line are all passable. */
function clearLine(g: DepthGrid, a: [number, number], b: [number, number], ok: (k: number) => boolean): boolean {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(a[0] + (b[0] - a[0]) * t);
    const y = Math.round(a[1] + (b[1] - a[1]) * t);
    if (!ok(y * g.nx + x)) return false;
  }
  return true;
}

/**
 * The deepest clear path from a to b as turning points (not including a and b), or null when
 * no path exists. An empty array means the straight line is already clear and deep enough.
 * Start and finish cells (and their neighbours) are always allowed: a boat can leave from a
 * shallow anchorage.
 */
export function findChannel(g: DepthGrid, a: LatLng, b: LatLng, o: ChannelOpts): LatLng[] | null {
  const comfort = o.comfortM ?? Math.max(5, o.minDepthM + 2);
  const pen = o.shallowPenalty ?? 4;
  const [ax, ay] = cellOf(g, a);
  const [bx, by] = cellOf(g, b);
  const near = (x: number, y: number) => (Math.abs(x - ax) <= 1 && Math.abs(y - ay) <= 1) || (Math.abs(x - bx) <= 1 && Math.abs(y - by) <= 1);
  const ok = (k: number) => passable(g, k, o.minDepthM) || near(k % g.nx, Math.floor(k / g.nx));
  // Comfortable all the way? Then nothing to add.
  const deepOk = (k: number) => ok(k) && (g.land[k] ? false : !(g.depth[k]! < comfort) || near(k % g.nx, Math.floor(k / g.nx)));
  if (clearLine(g, [ax, ay], [bx, by], deepOk)) return [];

  // Cell size in metres (cells are close to square at these scales).
  const mPerLat = 111_320;
  const midLat = (g.south + g.north) / 2;
  const cw = ((g.east - g.west) / g.nx) * mPerLat * Math.cos((midLat * Math.PI) / 180);
  const ch = ((g.north - g.south) / g.ny) * mPerLat;
  const cost = (k: number) => {
    const d = g.depth[k]!;
    if (!Number.isFinite(d) || d >= comfort) return 1;
    const t = Math.max(0, Math.min(1, (comfort - d) / Math.max(0.5, comfort - o.minDepthM)));
    return 1 + pen * t;
  };

  const N = g.nx * g.ny;
  const gScore = new Float64Array(N).fill(Infinity);
  const from = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const start = ay * g.nx + ax;
  const goal = by * g.nx + bx;
  const h = (k: number) => Math.hypot(((k % g.nx) - bx) * cw, (Math.floor(k / g.nx) - by) * ch);
  // Binary heap of [f, k].
  const heapF: number[] = [];
  const heapK: number[] = [];
  const push = (f: number, k: number) => {
    heapF.push(f);
    heapK.push(k);
    let i = heapF.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapF[p]! <= heapF[i]!) break;
      [heapF[p], heapF[i]] = [heapF[i]!, heapF[p]!];
      [heapK[p], heapK[i]] = [heapK[i]!, heapK[p]!];
      i = p;
    }
  };
  const pop = (): number => {
    const top = heapK[0]!;
    const lf = heapF.pop()!;
    const lk = heapK.pop()!;
    if (heapF.length) {
      heapF[0] = lf;
      heapK[0] = lk;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heapF.length && heapF[l]! < heapF[m]!) m = l;
        if (r < heapF.length && heapF[r]! < heapF[m]!) m = r;
        if (m === i) break;
        [heapF[m], heapF[i]] = [heapF[i]!, heapF[m]!];
        [heapK[m], heapK[i]] = [heapK[i]!, heapK[m]!];
        i = m;
      }
    }
    return top;
  };
  gScore[start] = 0;
  push(h(start), start);
  const dirs: Array<[number, number, number]> = [
    [1, 0, cw], [-1, 0, cw], [0, 1, ch], [0, -1, ch],
    [1, 1, Math.hypot(cw, ch)], [1, -1, Math.hypot(cw, ch)], [-1, 1, Math.hypot(cw, ch)], [-1, -1, Math.hypot(cw, ch)],
  ];
  let found = false;
  while (heapF.length) {
    const k = pop();
    if (closed[k]) continue;
    closed[k] = 1;
    if (k === goal) {
      found = true;
      break;
    }
    const x = k % g.nx;
    const y = Math.floor(k / g.nx);
    for (const [dx, dy, len] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= g.nx || ny >= g.ny) continue;
      const nk = ny * g.nx + nx;
      if (closed[nk] || !ok(nk)) continue;
      // No corner cutting between two blocked cells.
      if (dx && dy && (!ok(y * g.nx + nx) || !ok(ny * g.nx + x))) continue;
      const step = len * (cost(k) + cost(nk)) * 0.5;
      const ng = gScore[k]! + step;
      if (ng < gScore[nk]!) {
        gScore[nk] = ng;
        from[nk] = k;
        push(ng + h(nk), nk);
      }
    }
  }
  if (!found) return null;
  const path: Array<[number, number]> = [];
  for (let k = goal; k !== -1; k = from[k]!) path.push([k % g.nx, Math.floor(k / g.nx)]);
  path.reverse();
  // Line-of-sight smoothing that never shortcuts into shallower-than-comfortable water the
  // path itself avoided: keep the turning points a skipper would steer between.
  const keepDeep = (k: number) => ok(k) && cost(k) <= 1 + pen * 0.5;
  const out: LatLng[] = [];
  let i = 0;
  while (i < path.length - 1) {
    let j = path.length - 1;
    for (; j > i + 1; j--) {
      const pathMax = Math.max(...path.slice(i, j + 1).map(([x, y]) => cost(y * g.nx + x)));
      const test = pathMax <= 1 + pen * 0.5 ? keepDeep : ok;
      if (clearLine(g, path[i]!, path[j]!, test)) break;
    }
    if (j < path.length - 1) out.push(centre(g, path[j]![0], path[j]![1]));
    i = j;
  }
  return out;
}
