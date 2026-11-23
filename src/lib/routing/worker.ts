/// <reference lib="webworker" />
/**
 * Runs the passage planner off the main thread so the chart stays smooth.
 * The coastline is loaded once per app session and kept here.
 */
import { isDaylight } from "../sun.ts";
import { clearAround, landObstacle, loadLandPolygons, rasterize, shelterAround, type BBox, type Polygon } from "./land.ts";
import { loadReefPolygons, markReefs } from "./reefs.ts";
import { markShallow } from "./shallow-mask.ts";
import { findWindows, planPassage, type PlanInput, type PlanOutput, type WindowScan } from "./plan.ts";

export type PlanRequest = Omit<PlanInput, "obstacle" | "isDay"> & {
  id: number;
  box: BBox;
  /** "windows" scans the whole forecast for the best weather windows. */
  kind?: "plan" | "windows";
  marineUntil?: number;
  /** Keep out of water shallower than this (m below mean sea level) by the depth model. */
  minDepthM?: number;
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
    // Reefs as obstacles when this build bundles reef outlines.
    // The bundle may live under a sub-path (the website at /<repo>/app/); the worker sits in assets/.
    const base = self.location.pathname.includes("/assets/") ? new URL("../", self.location.href).href.replace(/\/$/, "") : self.location.origin;
    const reefs = await loadReefPolygons(base);
    if (reefs) markReefs(mask, reefs, rasterize);
    // A copy without the depth check, in case it closes every route (narrow channels).
    const coastOnly = { ...mask, cells: mask.cells.slice() };
    clearAround(coastOnly, [req.start, req.finish], 2500);
    if (req.minDepthM && req.minDepthM > 0) {
      const { loadDemTile } = await import("../depth.ts");
      await markShallow(mask, req.minDepthM, (z, x, y) => loadDemTile(z, x, y)).catch(() => 0);
    }
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
    const depthOn = Boolean(req.minDepthM && req.minDepthM > 0);
    let planned = planPassage({ ...req, obstacle: landObstacle(mask), isDay: isDaylight });
    let depthCheck: "used" | "relaxed" | "off" = depthOn ? "used" : "off";
    if (depthOn && !Object.values(planned.best).some(Boolean)) {
      // The depth model (hundreds of metres in places) can close narrow channels: try the coastline only.
      planned = planPassage({ ...req, obstacle: landObstacle(coastOnly), isDay: isDaylight });
      depthCheck = "relaxed";
    }
    const out = {
      ...planned,
      shelter,
      reefData: reefs ? ("used" as const) : ("missing" as const),
      depthCheck,
    };
    (self as unknown as Worker).postMessage({ id: req.id, ok: true, out } satisfies PlanReply);
  } catch (err) {
    (self as unknown as Worker).postMessage({
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : "Routing failed",
    } satisfies PlanReply);
  }
};
