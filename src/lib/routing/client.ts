/**
 * Main-thread entry for the passage planner: fetch the forecast grid for each
 * model, then route in a Web Worker.
 */
import { haversineMeters, type LatLng } from "../geo.ts";
import type { WeatherField } from "./field.ts";
import { ROUTE_MODELS, corridor, fetchField } from "./fetch-field.ts";
import type { PlanOutput } from "./plan.ts";
import type { BoatPerf } from "./polar.ts";
import type { Limits } from "./router.ts";
import type { PlanReply, PlanRequest } from "./worker.ts";

let worker: Worker | null = null;
let seq = 0;

function getWorker(): Worker {
  worker ??= new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  return worker;
}

export type PlanRun = {
  start: LatLng;
  finish: LatLng;
  windowStart: number;
  windowEnd: number;
  boat: BoatPerf;
  limits: Limits;
  onStatus?: (s: string) => void;
};

/** Keep fetched weather for 30 min so re-planning with new limits is instant. */
const cache = new Map<string, { at: number; fields: WeatherField[] }>();

export async function runPlan(run: PlanRun): Promise<PlanOutput> {
  const grid = corridor(run.start, run.finish);
  const directNm = haversineMeters(run.start, run.finish) / 1852;
  const days = (run.windowEnd - Date.now()) / 86_400_000 + directNm / 4 / 24 + 1;
  const key = `${grid.south.toFixed(2)},${grid.west.toFixed(2)},${grid.north.toFixed(2)},${grid.east.toFixed(2)},${Math.ceil(days)}`;
  let fields = cache.get(key);
  if (!fields || Date.now() - fields.at > 30 * 60_000) {
    run.onStatus?.("Downloading wind, waves and currents…");
    const got = await Promise.all(ROUTE_MODELS.map((m) => fetchField(grid, m, days).catch(() => null)));
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
    windowStart: run.windowStart,
    windowEnd: run.windowEnd,
    fields: fields.fields,
    boat: run.boat,
    limits: run.limits,
    box: grid,
  };
  const w = getWorker();
  return new Promise<PlanOutput>((resolve, reject) => {
    const onMsg = (e: MessageEvent<PlanReply>) => {
      if (e.data.id !== id) return;
      w.removeEventListener("message", onMsg);
      if (e.data.ok) resolve(e.data.out);
      else reject(new Error(e.data.error));
    };
    w.addEventListener("message", onMsg);
    w.addEventListener("error", (err) => reject(new Error(err.message || "Routing failed")), { once: true });
    w.postMessage(req);
  });
}
