/**
 * Spoken prompts while following a track: what to say, and when. Pure (the speaking itself is in
 * `components/helm/voice-guide.ts`), so the timing rules are tested. Eyes stay on the water: the
 * phone says the next mark, the turn before it comes, the turn when it's due, and how far off the
 * line the boat is, without repeating itself.
 */
import type { TurnAhead } from "./steer.ts";
import type { LengthUnit } from "./units.ts";

export type VoiceInput = {
  /** Mark being steered for (0 = the start). */
  index: number;
  /** Marks on the track. */
  count: number;
  toMarkM: number;
  turn: TurnAhead | null;
  /** Cross-track error, + starboard of the line. Null before the first mark. */
  xteM: number | null;
  speedMs: number;
  now: number;
};

export type VoiceMemory = {
  index: number;
  aheadSaid: number;
  nowSaid: number;
  arrivalSaid: boolean;
  offSide: "P" | "S" | null;
  offM: number;
  offAt: number;
  started: boolean;
};

export const newVoiceMemory = (): VoiceMemory => ({
  index: -1,
  aheadSaid: -1,
  nowSaid: -1,
  arrivalSaid: false,
  offSide: null,
  offM: 0,
  offAt: 0,
  started: false,
});

/** Off the line by this much is spoken; back under `BACK_M` is "back on the line". */
export const OFF_LINE_M = 5;
const BACK_M = 2;
/** While off the line, repeat at most this often unless it gets worse. */
const OFF_REPEAT_MS = 20_000;

/** A distance said aloud: "50 metres", "1.2 kilometres", "160 feet". */
export function spokenDistance(m: number, unit: LengthUnit = "m"): string {
  const a = Math.max(0, m);
  if (unit === "ft") {
    const ft = a / 0.3048;
    if (ft >= 2000) return `${(a / 1852).toFixed(1)} nautical miles`;
    const r = ft < 300 ? Math.round(ft / 10) * 10 : Math.round(ft / 50) * 50;
    return `${Math.max(10, r)} feet`;
  }
  if (a >= 1000) return `${(a / 1000).toFixed(1)} kilometres`;
  const r = a < 100 ? Math.round(a / 5) * 5 : Math.round(a / 10) * 10;
  return `${Math.max(5, r)} metres`;
}

const side = (deg: number) => (deg > 0 ? "starboard" : "port");
const heading = (d: number) => `${String(Math.round(((d % 360) + 360) % 360)).padStart(3, "0").split("").join(" ")}`;

/** How far before a turn to warn: about 30 seconds of boat speed, at least 40 m, at most 150 m. */
export const aheadM = (speedMs: number) => Math.min(150, Math.max(40, speedMs * 30));

/**
 * What to say now (or null), and the memory to keep. One sentence at most per call; the most
 * urgent wins: turn now, arrival, a new mark, the turn coming up, then off the line.
 */
export function voicePrompt(input: VoiceInput, mem: VoiceMemory, unit: LengthUnit = "m"): { say: string | null; mem: VoiceMemory } {
  const m = { ...mem };
  const d = (x: number) => spokenDistance(x, unit);
  const { index, count, turn } = input;
  if (count < 2 || index < 0) return { say: null, mem: m };

  // Turn now (once per turn).
  if (turn?.now && "turnDeg" in turn && m.nowSaid !== turn.index) {
    m.nowSaid = turn.index;
    m.aheadSaid = Math.max(m.aheadSaid, turn.index);
    m.index = Math.max(m.index, index);
    return { say: `Turn ${side(turn.turnDeg)} now, ${Math.round(Math.abs(turn.turnDeg))} degrees, to ${heading(turn.newCourse)}.`, mem: m };
  }
  // Arrival (once).
  if (turn && "arrival" in turn && turn.now && !m.arrivalSaid) {
    m.arrivalSaid = true;
    m.index = Math.max(m.index, index);
    return { say: "Arriving at the last mark.", mem: m };
  }
  // First call, and each new mark.
  if (!m.started || index > m.index) {
    const first = !m.started;
    m.started = true;
    m.index = index;
    if (index === 0) return { say: `Head to the start, ${d(input.toMarkM)}.`, mem: m };
    if (index === count - 1) return { say: `${first ? "" : "Mark passed. "}Last mark in ${d(input.toMarkM)}.`, mem: m };
    let then = "";
    if (turn && "turnDeg" in turn && turn.index === index) {
      then = `, then ${Math.round(Math.abs(turn.turnDeg))} degrees to ${side(turn.turnDeg)}`;
      if (input.toMarkM <= aheadM(input.speedMs)) m.aheadSaid = turn.index;
    }
    return { say: `Mark ${index + 1} in ${d(input.toMarkM)}${then}.`, mem: m };
  }
  // The turn coming up, about 30 seconds out (once per turn).
  if (turn && "turnDeg" in turn && !turn.now && m.aheadSaid < turn.index && turn.distM <= aheadM(input.speedMs)) {
    m.aheadSaid = turn.index;
    return { say: `In ${d(turn.distM)}, turn ${Math.round(Math.abs(turn.turnDeg))} degrees to ${side(turn.turnDeg)}.`, mem: m };
  }
  // Off the line: say it, repeat while it lasts (sooner if worse), and say when back on.
  const x = input.xteM;
  if (x != null && Number.isFinite(x) && index > 0) {
    const a = Math.abs(x);
    const s = x >= 0 ? "S" : "P";
    if (a >= OFF_LINE_M) {
      const changed = m.offSide !== s;
      const worse = a >= m.offM + 5;
      if (changed || worse || input.now - m.offAt >= OFF_REPEAT_MS) {
        m.offSide = s;
        m.offM = a;
        m.offAt = input.now;
        return { say: `You're ${d(a)} to ${s === "S" ? "starboard" : "port"}. Steer ${s === "S" ? "port" : "starboard"}.`, mem: m };
      }
    } else if (m.offSide && a < BACK_M) {
      m.offSide = null;
      m.offM = 0;
      return { say: "Back on the line.", mem: m };
    }
  }
  return { say: null, mem: m };
}
