/**
 * Main-thread entry for the passage planner: fetch the forecast grid for each
 * model, then route in a Web Worker.
 */
import { haversineMeters, type LatLng } from "../geo.ts";
import type { WeatherField } from "./field.ts";
import { ROUTE_MODELS, corridor, fetchField } from "./fetch-field.ts";
import type { PlanOutput, WindowScan } from "./plan.ts";
import type { BoatPerf } from "./polar.ts";
import type { Limits, RouteRules } from "./router.ts";
import type { PlanReply, PlanRequest } from "./worker.ts";

let worker: Worker | null = null;

/** The forecast box around every point of the passage (start, waypoints, finish). */
function corridorAll(start: LatLng, finish: LatLng, via: LatLng[] = []) {
  const pts = [start, ...via, finish];
  const lo = { lat: Math.min(...pts.map((p) => p.lat)), lng: Math.min(...pts.map((p) => p.lng)) };
  const hi = { lat: Math.max(...pts.map((p) => p.lat)), lng: Math.max(...pts.map((p) => p.lng)) };
  return via.length ? corridor(lo, hi) : corridor(start, finish);
}

/** Total straight-line length through the waypoints, metres. */
function legsM(start: LatLng, finish: LatLng, via: LatLng[] = []): number {
  const pts = [start, ...via, finish];
  let m = 0;
  for (let i = 1; i < pts.length; i += 1) m += haversineMeters(pts[i - 1]!, pts[i]!);
  return m;
}
let seq = 0;

function getWorker(): Worker {
  worker ??= new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  return worker;
}

export type PlanRun = {
  start: LatLng;
  finish: LatLng;
  /** The skipper's turning points, in order. */
  via?: LatLng[];
  windowStart: number;
  windowEnd: number;
  boat: BoatPerf;
  limits: Limits;
  rules?: RouteRules;
  /** Model ids from ROUTE_MODELS, main first. */
  models?: string[];
  /** Keep out of water shallower than this (m, mean sea level), by the depth model. */
  minDepthM?: number;
  onStatus?: (s: string) => void;
};

/** Keep fetched weather for 30 min so re-planning with new limits is instant. */
const cache = new Map<string, { at: number; fields: WeatherField[] }>();

export type PlanRunResult = { out: PlanOutput; fields: WeatherField[]; box: PlanRequest["box"]; forecastAt: number };

/** Re-plan on a forecast already on the phone (offline re-routing). */
export function planOnFields(run: PlanRun & { fields: WeatherField[]; box: PlanRequest["box"] }): Promise<PlanOutput> {
  return sendToWorker({
    id: (seq += 1),
    start: run.start,
    finish: run.finish,
    via: run.via,
    windowStart: run.windowStart,
    windowEnd: run.windowEnd,
    fields: run.fields,
    boat: run.boat,
    limits: run.limits,
    rules: run.rules,
    box: run.box,
    minDepthM: run.minDepthM,
  });
}

function sendToWorker(req: PlanRequest): Promise<PlanOutput> {
  return post(req).then((r) => r.out!);
}

function post(req: PlanRequest): Promise<Extract<PlanReply, { ok: true }>> {
  const w = getWorker();
  return new Promise((resolve, reject) => {
    const onMsg = (e: MessageEvent<PlanReply>) => {
      if (e.data.id !== req.id) return;
      w.removeEventListener("message", onMsg);
      if (e.data.ok) resolve(e.data);
      else reject(new Error(e.data.error));
    };
    w.addEventListener("message", onMsg);
    w.addEventListener("error", (err) => reject(new Error(err.message || "Routing failed")), { once: true });
    w.postMessage(req);
  });
}

export async function runPlan(run: PlanRun): Promise<PlanRunResult> {
  const grid = corridorAll(run.start, run.finish, run.via);
  const directNm = legsM(run.start, run.finish, run.via) / 1852;
  const days = (run.windowEnd - Date.now()) / 86_400_000 + directNm / 4 / 24 + 1;
  const models = (run.models?.length ? run.models : ["ecmwf", "gfs"])
    .map((id) => ROUTE_MODELS.find((m) => m.id === id))
    .filter((m): m is (typeof ROUTE_MODELS)[number] => Boolean(m));
  const key = `${grid.south.toFixed(2)},${grid.west.toFixed(2)},${grid.north.toFixed(2)},${grid.east.toFixed(2)},${Math.ceil(days)},${models.map((m) => m.id).join("+")}`;
  let fields = cache.get(key);
  if (!fields || Date.now() - fields.at > 30 * 60_000) {
    run.onStatus?.("Downloading wind, waves and currents…");
    const got = await Promise.all(models.map((m) => fetchField(grid, m, days).catch(() => null)));
    const ok = got.filter((f): f is WeatherField => f != null);
    if (!ok.length) throw new Error("Couldn't download the forecast. Check your signal and try again.");
    fields = { at: Date.now(), fields: ok };
    cache.set(key, fields);
  }
  run.onStatus?.("Working out routes…");
  const id = (seq += 1);
  const req: PlanRequest = {
    id,
    start: run.start,
    finish: run.finish,
    via: run.via,
    windowStart: run.windowStart,
    windowEnd: run.windowEnd,
    fields: fields.fields,
    boat: run.boat,
    limits: run.limits,
    rules: run.rules,
    box: grid,
    minDepthM: run.minDepthM,
  };
  const out = await sendToWorker(req);
  return { out, fields: fields.fields, box: grid, forecastAt: fields.at };
}

/**
 * Scan the next ~10 days for the best weather windows for this passage. Uses the
 * main model only (the scan is about timing; models are compared when planning).
 */
export async function findWeatherWindows(run: Omit<PlanRun, "windowStart" | "windowEnd">): Promise<WindowScan> {
  const grid = corridorAll(run.start, run.finish, run.via);
  const directNm = legsM(run.start, run.finish, run.via) / 1852;
  const main = ROUTE_MODELS.find((m) => m.id === (run.models?.[0] ?? "ecmwf")) ?? ROUTE_MODELS[0]!;
  run.onStatus?.("Downloading 10 days of weather…");
  const field = await fetchField(grid, main, 10);
  const end = field.times[field.times.length - 1]!;
  const tripH = Math.max(2, directNm / 4);
  const from = Math.ceil(Date.now() / 3_600_000) * 3_600_000;
  const to = end - tripH * 3_600_000;
  if (to <= from) throw new Error("This passage is too long for the forecast range.");
  run.onStatus?.("Looking for the best windows…");
  const res = await post({
    id: (seq += 1),
    kind: "windows",
    minDepthM: run.minDepthM,
    start: run.start,
    finish: run.finish,
    via: run.via,
    windowStart: from,
    windowEnd: to,
    fields: [field],
    boat: run.boat,
    limits: run.limits,
    rules: run.rules,
    box: grid,
    // The marine model runs about 8 days.
    marineUntil: from + 8 * 86_400_000,
  });
  return res.scan!;
}
