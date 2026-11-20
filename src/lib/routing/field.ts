/**
 * A weather field over the route corridor: wind, gust, waves and current on a
 * regular lat/lng grid, hourly. Values are read anywhere by bilinear interpolation
 * in space and linear in time. Directions are interpolated as vectors so 350° and
 * 10° average to 0°, not 180°.
 */
export type Grid = {
  /** South-west corner and spacing, degrees. */
  lat0: number;
  lng0: number;
  dLat: number;
  dLng: number;
  ny: number;
  nx: number;
  /** Epoch ms of each hourly layer. */
  times: number[];
};

/** Arrays are [t][iy * nx + ix]. Directions: wind FROM, waves FROM, current TOWARD. NaN = missing. */
export type FieldData = {
  windKn: Float32Array[];
  windDir: Float32Array[];
  gustKn: Float32Array[];
  waveM: Float32Array[];
  waveDir: Float32Array[];
  /** Wave period, seconds (optional: older fields and tests may leave it empty). */
  wavePer?: Float32Array[];
  curKn: Float32Array[];
  curDir: Float32Array[];
  /** Convective fields for storm risk (optional). */
  capeJkg?: Float32Array[];
  liftedIndex?: Float32Array[];
  cinJkg?: Float32Array[];
  precipMm?: Float32Array[];
  code?: Float32Array[];
  tempC?: Float32Array[];
};

export type WeatherField = Grid & FieldData & { model: string; fetchedAt?: number };

export type Conditions = {
  windKn: number;
  /** Direction the wind blows FROM. */
  windDir: number;
  gustKn: number;
  waveM: number;
  /** Direction waves come FROM. */
  waveDir: number;
  /** Wave period, seconds; 0 if unknown. */
  wavePerS: number;
  curKn: number;
  /** Direction the current sets TOWARD. */
  curDir: number;
  capeJkg: number;
  liftedIndex: number;
  cinJkg: number;
  precipMm: number;
  code: number;
  tempC: number;
};

const DEG = Math.PI / 180;

function cell(g: Grid, lat: number, lng: number) {
  const fy = Math.min(Math.max((lat - g.lat0) / g.dLat, 0), g.ny - 1);
  const fx = Math.min(Math.max((lng - g.lng0) / g.dLng, 0), g.nx - 1);
  const y0 = Math.floor(fy);
  const x0 = Math.floor(fx);
  const y1 = Math.min(y0 + 1, g.ny - 1);
  const x1 = Math.min(x0 + 1, g.nx - 1);
  return { y0, x0, y1, x1, ty: fy - y0, tx: fx - x0 };
}

function timeIndex(times: number[], at: number) {
  if (at <= times[0]!) return { i0: 0, i1: 0, t: 0 };
  const last = times.length - 1;
  if (at >= times[last]!) return { i0: last, i1: last, t: 0 };
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= at) lo = mid;
    else hi = mid;
  }
  return { i0: lo, i1: hi, t: (at - times[lo]!) / (times[hi]! - times[lo]!) };
}

type Weights = { idx: number[]; w: number[] };

function weights(g: Grid, lat: number, lng: number): Weights {
  const c = cell(g, lat, lng);
  const n = g.nx;
  return {
    idx: [c.y0 * n + c.x0, c.y0 * n + c.x1, c.y1 * n + c.x0, c.y1 * n + c.x1],
    w: [(1 - c.ty) * (1 - c.tx), (1 - c.ty) * c.tx, c.ty * (1 - c.tx), c.ty * c.tx],
  };
}

function scalar(layers: Float32Array[], ti: ReturnType<typeof timeIndex>, wt: Weights): number {
  let a = 0;
  let b = 0;
  let wa = 0;
  let wb = 0;
  const L0 = layers[ti.i0]!;
  const L1 = layers[ti.i1]!;
  for (let k = 0; k < 4; k += 1) {
    const v0 = L0[wt.idx[k]!]!;
    const v1 = L1[wt.idx[k]!]!;
    if (Number.isFinite(v0)) {
      a += v0 * wt.w[k]!;
      wa += wt.w[k]!;
    }
    if (Number.isFinite(v1)) {
      b += v1 * wt.w[k]!;
      wb += wt.w[k]!;
    }
  }
  const va = wa > 0 ? a / wa : NaN;
  const vb = wb > 0 ? b / wb : NaN;
  if (!Number.isFinite(va)) return vb;
  if (!Number.isFinite(vb)) return va;
  return va + (vb - va) * ti.t;
}

/** Speed + direction pair, averaged as vectors. */
function vector(
  speed: Float32Array[],
  dir: Float32Array[],
  ti: ReturnType<typeof timeIndex>,
  wt: Weights,
): { speed: number; dir: number } {
  let u = 0;
  let v = 0;
  let w = 0;
  for (const [layer, tw] of [
    [ti.i0, 1 - ti.t],
    [ti.i1, ti.t],
  ] as const) {
    if (tw === 0) continue;
    const S = speed[layer]!;
    const D = dir[layer]!;
    for (let k = 0; k < 4; k += 1) {
      const s = S[wt.idx[k]!]!;
      const d = D[wt.idx[k]!]!;
      if (!Number.isFinite(s) || !Number.isFinite(d)) continue;
      const ww = wt.w[k]! * tw;
      u += s * Math.sin(d * DEG) * ww;
      v += s * Math.cos(d * DEG) * ww;
      w += ww;
    }
  }
  if (w === 0) return { speed: NaN, dir: NaN };
  u /= w;
  v /= w;
  return { speed: Math.hypot(u, v), dir: ((Math.atan2(u, v) / DEG) + 360) % 360 };
}

export function conditionsAt(f: WeatherField, lat: number, lng: number, at: number): Conditions {
  const ti = timeIndex(f.times, at);
  const wt = weights(f, lat, lng);
  const wind = vector(f.windKn, f.windDir, ti, wt);
  const wave = vector(f.waveM, f.waveDir, ti, wt);
  const cur = vector(f.curKn, f.curDir, ti, wt);
  const gust = scalar(f.gustKn, ti, wt);
  const per = f.wavePer ? scalar(f.wavePer, ti, wt) : NaN;
  const opt = (L?: Float32Array[]) => (L ? scalar(L, ti, wt) : NaN);
  // Weather code is a category: take the nearest cell and hour, never an average.
  const code = f.code ? f.code[ti.t < 0.5 ? ti.i0 : ti.i1]![wt.idx[wt.w.indexOf(Math.max(...wt.w))]!]! : NaN;
  return {
    windKn: Number.isFinite(wind.speed) ? wind.speed : 0,
    windDir: Number.isFinite(wind.dir) ? wind.dir : 0,
    gustKn: Number.isFinite(gust) ? gust : Number.isFinite(wind.speed) ? wind.speed * 1.3 : 0,
    waveM: Number.isFinite(wave.speed) ? wave.speed : 0,
    waveDir: Number.isFinite(wave.dir) ? wave.dir : 0,
    wavePerS: Number.isFinite(per) ? per : 0,
    curKn: Number.isFinite(cur.speed) ? cur.speed : 0,
    curDir: Number.isFinite(cur.dir) ? cur.dir : 0,
    capeJkg: opt(f.capeJkg),
    liftedIndex: opt(f.liftedIndex),
    cinJkg: opt(f.cinJkg),
    precipMm: Number.isFinite(opt(f.precipMm)) ? opt(f.precipMm) : 0,
    code: Number.isFinite(code) ? code : 0,
    tempC: opt(f.tempC),
  };
}

export function fieldEnd(f: WeatherField): number {
  return f.times[f.times.length - 1]!;
}

/** A uniform field, for tests and for a quick "same everywhere" check. */
export function uniformField(
  c: Partial<Conditions> & { windKn: number; windDir: number },
  bbox: { south: number; west: number; north: number; east: number },
  start: number,
  hours: number,
): WeatherField {
  const nx = 3;
  const ny = 3;
  const times = Array.from({ length: hours + 1 }, (_, i) => start + i * 3_600_000);
  const fill = (v: number) => times.map(() => new Float32Array(nx * ny).fill(v));
  return {
    model: "uniform",
    lat0: bbox.south,
    lng0: bbox.west,
    dLat: (bbox.north - bbox.south) / (ny - 1),
    dLng: (bbox.east - bbox.west) / (nx - 1),
    ny,
    nx,
    times,
    windKn: fill(c.windKn),
    windDir: fill(c.windDir),
    gustKn: fill(c.gustKn ?? c.windKn * 1.25),
    waveM: fill(c.waveM ?? 0),
    waveDir: fill(c.waveDir ?? c.windDir),
    wavePer: fill(c.wavePerS ?? NaN),
    curKn: fill(c.curKn ?? 0),
    curDir: fill(c.curDir ?? 0),
  };
}
