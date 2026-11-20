/**
 * Apparent wind and the sail plan.
 *
 * Apparent wind (what the instruments and the crew feel, and what sail ranges are
 * set by) comes from the wind triangle with the boat's speed through the water V:
 *   AWS = √(TWS² + V² + 2·TWS·V·cos TWA)
 *   AWA = acos((TWS·cos TWA + V) / AWS)
 * The sail plan picks, for each stretch, the main's reef state and the best
 * headsail or downwind sail from the skipper's own inventory, using apparent
 * wind ranges. Templates are typical sailmaker ranges: a starting point only.
 */
import type { RoutePoint } from "./router.ts";

export function apparentWind(twsKn: number, twaDeg: number, stwKn: number): { aws: number; awa: number } {
  const t = (twaDeg * Math.PI) / 180;
  const aws = Math.sqrt(twsKn * twsKn + stwKn * stwKn + 2 * twsKn * stwKn * Math.cos(t));
  if (aws < 1e-6) return { aws: 0, awa: 0 };
  const c = Math.min(1, Math.max(-1, (twsKn * Math.cos(t) + stwKn) / aws));
  return { aws, awa: (Math.acos(c) * 180) / Math.PI };
}

export type SailKind = "main" | "headsail" | "downwind";

export type SailDef = {
  id: string;
  kind: SailKind;
  name: string;
  owned: boolean;
  /** Apparent wind angle range, degrees. */
  awaMin: number;
  awaMax: number;
  /** Apparent wind speed range, knots. */
  awsMin: number;
  awsMax: number;
  /** Main only: AWS at which to take reef 1, 2, 3 (0 = no such reef). */
  reefs?: [number, number, number];
};

export const DEFAULT_SAILS: SailDef[] = [
  { id: "main", kind: "main", name: "Mainsail", owned: true, awaMin: 0, awaMax: 180, awsMin: 0, awsMax: 45, reefs: [18, 24, 30] },
  { id: "code0", kind: "downwind", name: "Code zero", owned: false, awaMin: 45, awaMax: 100, awsMin: 0, awsMax: 14 },
  { id: "asym", kind: "downwind", name: "Asymmetric spinnaker", owned: false, awaMin: 95, awaMax: 165, awsMin: 0, awsMax: 18 },
  { id: "sym", kind: "downwind", name: "Symmetric spinnaker", owned: false, awaMin: 120, awaMax: 180, awsMin: 0, awsMax: 20 },
  { id: "genoa", kind: "headsail", name: "Genoa", owned: true, awaMin: 25, awaMax: 150, awsMin: 0, awsMax: 24 },
  { id: "jib", kind: "headsail", name: "Jib", owned: false, awaMin: 25, awaMax: 140, awsMin: 12, awsMax: 35 },
  { id: "staysail", kind: "headsail", name: "Staysail", owned: false, awaMin: 30, awaMax: 120, awsMin: 22, awsMax: 42 },
];

export function readSails(v: unknown): SailDef[] {
  if (!Array.isArray(v)) return DEFAULT_SAILS;
  const byId = new Map(DEFAULT_SAILS.map((s) => [s.id, s]));
  const out: SailDef[] = [];
  for (const raw of v as Partial<SailDef>[]) {
    const base = raw && typeof raw.id === "string" ? byId.get(raw.id) : undefined;
    if (!base) continue;
    const n = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
    out.push({
      ...base,
      owned: typeof raw.owned === "boolean" ? raw.owned : base.owned,
      awaMin: n(raw.awaMin, base.awaMin),
      awaMax: n(raw.awaMax, base.awaMax),
      awsMin: n(raw.awsMin, base.awsMin),
      awsMax: n(raw.awsMax, base.awsMax),
      reefs: base.reefs
        ? ([0, 1, 2].map((i) => n(raw.reefs?.[i], base.reefs![i]!)) as [number, number, number])
        : undefined,
    });
  }
  // Keep any templates added in newer versions.
  for (const s of DEFAULT_SAILS) if (!out.some((o) => o.id === s.id)) out.push(s);
  return out;
}

export type SailSetup = { main: string; head: string; motoring: boolean };

function mainState(main: SailDef | undefined, aws: number): string {
  if (!main?.owned) return "";
  const [r1, r2, r3] = main.reefs ?? [0, 0, 0];
  if (r3 && aws >= r3) return "Main reef 3";
  if (r2 && aws >= r2) return "Main reef 2";
  if (r1 && aws >= r1) return "Main reef 1";
  return "Full main";
}

const PRIORITY = ["code0", "asym", "sym", "genoa", "jib", "staysail"];

export function chooseSails(sails: SailDef[], aws: number, awa: number, motoring: boolean): SailSetup {
  const main = sails.find((s) => s.kind === "main");
  if (motoring) return { main: mainState(main, aws) ? "Main up" : "", head: "Engine", motoring: true };
  const owned = sails.filter((s) => s.owned && s.kind !== "main");
  const fits = (s: SailDef) => awa >= s.awaMin && awa <= s.awaMax && aws >= s.awsMin && aws <= s.awsMax;
  const ranked = [...owned].sort((a, b) => PRIORITY.indexOf(a.id) - PRIORITY.indexOf(b.id));
  let head = ranked.find(fits);
  if (!head) {
    // Nothing fits exactly: the headsail whose range is closest.
    const gap = (s: SailDef) =>
      Math.max(0, s.awaMin - awa, awa - s.awaMax) / 30 + Math.max(0, s.awsMin - aws, aws - s.awsMax) / 5;
    head = owned.filter((s) => s.kind === "headsail").sort((a, b) => gap(a) - gap(b))[0];
  }
  let headName = head?.name ?? "";
  if (head?.id === "genoa" && aws > 18) headName = "Genoa furled ~70%";
  return { main: mainState(main, aws), head: headName, motoring: false };
}

export type SailSegment = SailSetup & { from: number; to: number; aws: number; awa: number };
export type SailChange = { at: number; text: string; setup: SailSetup };

const MIN_SEGMENT_MS = 30 * 60_000;

function same(a: SailSetup, b: SailSetup) {
  return a.main === b.main && a.head === b.head && a.motoring === b.motoring;
}

export function sailPlan(points: RoutePoint[], sails: SailDef[]): { segments: SailSegment[]; changes: SailChange[] } {
  const segs: SailSegment[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p = points[i]!;
    const { aws, awa } = apparentWind(p.twsKn, p.twa, p.stwKn);
    const setup = chooseSails(sails, aws, awa, p.motoring);
    const last = segs[segs.length - 1];
    if (last && same(last, setup)) last.to = points[i + 1]!.at;
    else segs.push({ ...setup, from: p.at, to: points[i + 1]!.at, aws, awa });
  }
  // Fold stretches shorter than 30 min into the one before (or after, at the start).
  for (let i = 0; i < segs.length; ) {
    const s = segs[i]!;
    if (segs.length > 1 && s.to - s.from < MIN_SEGMENT_MS) {
      const into = i > 0 ? segs[i - 1]! : segs[i + 1]!;
      into.from = Math.min(into.from, s.from);
      into.to = Math.max(into.to, s.to);
      segs.splice(i, 1);
      if (i > 0 && i < segs.length && same(segs[i - 1]!, segs[i]!)) {
        segs[i - 1]!.to = segs[i]!.to;
        segs.splice(i, 1);
      }
      i = Math.max(0, i - 1);
      continue;
    }
    i += 1;
  }
  const changes: SailChange[] = segs.map((s, i) => ({
    at: s.from,
    setup: s,
    text: i === 0 ? `Set ${describe(s)}` : changeText(segs[i - 1]!, s),
  }));
  return { segments: segs, changes };
}

export function describe(s: SailSetup): string {
  if (s.motoring) return s.main ? "engine, main up" : "engine";
  return [s.main, s.head].filter(Boolean).join(" + ") || "sails";
}

function changeText(a: SailSetup, b: SailSetup): string {
  if (b.motoring && !a.motoring) return "Engine on";
  if (a.motoring && !b.motoring) return `Engine off, set ${describe(b)}`;
  const parts: string[] = [];
  if (a.main !== b.main) parts.push(b.main.replace("Main ", "").replace("Full main", "shake out to full main"));
  if (a.head !== b.head) parts.push(`${b.head}`);
  return parts.join(", ").replace(/^reef/, "Reef") || describe(b);
}
