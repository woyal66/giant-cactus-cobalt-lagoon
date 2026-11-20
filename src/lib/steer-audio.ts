import { alarmContext } from "./alarm.ts";

/** Past this, the plain tick becomes a side cue. Inside it, you are on the line. */
export const STEER_EAR_M = 2;

export type SteerEarKind = "plain" | "port" | "starboard";

/**
 * Which way to steer. Positive XTE is starboard of the line, so the correction is to port.
 * Hysteresis: the side cue starts at 2 m and lets go again inside 1.4 m, so GPS wander
 * does not flicker the sound on the boundary.
 */
export function classifySteer(xteM: number, wasOff: boolean): SteerEarKind {
  const abs = Math.abs(xteM);
  const off = wasOff ? abs >= 1.4 : abs >= STEER_EAR_M;
  if (!off) return "plain";
  return xteM > 0 ? "port" : "starboard";
}

/** Gap between cues. Further off the line, the cue comes faster. */
export function steerGapMs(kind: SteerEarKind, xteM: number): number {
  if (kind === "plain") return 2000;
  const over = Math.min(6, Math.max(0, Math.abs(xteM) - STEER_EAR_M));
  return Math.round(1100 - (over / 6) * 700);
}

let wasOff = false;
let timer: number | null = null;
let running = false;

function blip(
  a: AudioContext,
  freq: number,
  durMs: number,
  peak: number,
  pan: number,
  delayMs = 0,
) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = a.currentTime + delayMs / 1000;
  const t1 = t0 + durMs / 1000;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(t0 + 0.03, t1));
  osc.connect(gain);
  if (typeof a.createStereoPanner === "function" && Math.abs(pan) > 0.05) {
    const panner = a.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    gain.connect(panner);
    panner.connect(a.destination);
  } else {
    gain.connect(a.destination);
  }
  osc.start(t0);
  osc.stop(t1 + 0.04);
}

function play(kind: SteerEarKind, xteM: number) {
  const a = alarmContext();
  if (!a) return;
  if (a.state === "suspended") void a.resume();
  if (kind === "plain") {
    blip(a, 520, 70, 0.028, 0);
    return;
  }
  const urgency = Math.min(1, Math.max(0, (Math.abs(xteM) - STEER_EAR_M) / 6));
  const peak = 0.05 + urgency * 0.05;
  if (kind === "port") {
    blip(a, 880, 55, peak, -0.9);
    blip(a, 880, 55, peak, -0.9, 100);
    return;
  }
  blip(a, 320, 190, peak, 0.9);
}

function arm(xteM: number) {
  if (!running) return;
  const kind = classifySteer(xteM, wasOff);
  wasOff = kind !== "plain";
  play(kind, xteM);
  timer = window.setTimeout(() => arm(latestXte), steerGapMs(kind, xteM));
}

let latestXte = 0;

/** Follow a track by ear. Pass null to stop. */
export function setSteerEar(xteM: number | null) {
  if (xteM == null || !Number.isFinite(xteM)) {
    stopSteerEar();
    return;
  }
  latestXte = xteM;
  if (running) return;
  running = true;
  arm(xteM);
}

export function stopSteerEar() {
  running = false;
  wasOff = false;
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }
}
