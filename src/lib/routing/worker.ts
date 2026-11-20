/// <reference lib="webworker" />
/**
 * Runs the passage planner off the main thread so the chart stays smooth.
 * The coastline is loaded once per app session and kept here.
 */
import { isDaylight } from "../sun.ts";
import { clearAround, landObstacle, loadLandPolygons, rasterize, shelterAround, type BBox, type Polygon } from "./land.ts";
import { findWindows, planPassage, type PlanInput, type PlanOutput, type WindowScan } from "./plan.ts";

export type PlanRequest = Omit<PlanInput, "obstacle" | "isDay"> & {
  id: number;
  box: BBox;
  /** "windows" scans the whole forecast for the best weather windows. */
  kind?: "plan" | "windows";
  marineUntil?: number;
};
export type PlanReply =
  | { id: number; ok: true; out: PlanOutput; scan?: undefined }
  | { id: number; ok: true; scan: WindowScan; out?: undefined }
  | { id: number; ok: false; error: string };

let land: Promise<Polygon[]> | null = null;

self.onmessage = async (e: MessageEvent<PlanRequest>) => {
  const req = e.data;
  try {
    land ??= loadLandPolygons();
    const polys = await land.catch(() => [] as Polygon[]);
    const span = Math.max(req.box.east - req.box.west, req.box.north - req.box.south);
    const mask = rasterize(polys, req.box, Math.max(0.003, span / 700));
    const shelter = polys.length ? shelterAround(mask, req.finish) : undefined;
    clearAround(mask, [req.start, req.finish], 2500);
    if (req.kind === "windows") {
      const scan = findWindows({
        ...req,
        from: req.windowStart,
        to: req.windowEnd,
        obstacle: landObstacle(mask),
        isDay: isDaylight,
      });
      (self as unknown as Worker).postMessage({ id: req.id, ok: true, scan } satisfies PlanReply);
      return;
    }
    const out = { ...planPassage({ ...req, obstacle: landObstacle(mask), isDay: isDaylight }), shelter };
    (self as unknown as Worker).postMessage({ id: req.id, ok: true, out } satisfies PlanReply);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : "Routing failed",
    } satisfies PlanReply);
  }
};
