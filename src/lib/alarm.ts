export const ALARM_SOUNDS = [
  { id: "klaxon", name: "Klaxon", detail: "Two-tone bridge" },
  { id: "foghorn", name: "Foghorn", detail: "Low blast" },
  { id: "bell", name: "Bell", detail: "Fast pings" },
] as const;

export type AlarmSoundId = (typeof ALARM_SOUNDS)[number]["id"];

export function isAlarmSound(v: unknown): v is AlarmSoundId {
  return v === "klaxon" || v === "foghorn" || v === "bell";
}

let ctx: AudioContext | null = null;
let loopTimer: number | null = null;
let stopTimer: number | null = null;
let voices: Array<{ osc: OscillatorNode; gain: GainNode }> = [];
let loopingId: AlarmSoundId | null = null;
let out: AudioNode | null = null;

/**
 * Alarm voices run through a limiter so they can be loud (this has to wake a
 * sleeping crew) without clipping into distortion on small phone speakers.
 */
function output(a: AudioContext): AudioNode {
  if (out) return out;
  const comp = a.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 6;
  comp.ratio.value = 12;
  comp.attack.value = 0.002;
  comp.release.value = 0.12;
  const master = a.createGain();
  master.gain.value = 0.95;
  comp.connect(master);
  master.connect(a.destination);
  out = comp;
  return out;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

export function unlockAlarmAudio() {
  const a = audio();
  if (a && a.state === "suspended") void a.resume();
}

export function alarmContext(): AudioContext | null {
  return audio();
}

function pulse(
  a: AudioContext,
  freq: number,
  durMs: number,
  peak: number,
  type: OscillatorType,
  delayMs = 0,
) {
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = a.currentTime + delayMs / 1000;
  const t1 = t0 + durMs / 1000;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(t0 + 0.03, t1));
  osc.connect(gain);
  gain.connect(output(a));
  osc.start(t0);
  osc.stop(t1 + 0.04);
  const voice = { osc, gain };
  voices.push(voice);
  // Drop finished voices; otherwise a long alarm keeps thousands of nodes alive.
  osc.onended = () => {
    voices = voices.filter((v) => v !== voice);
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {
      /* already gone */
    }
  };
}

function playCycle(id: AlarmSoundId) {
  const a = audio();
  if (!a) return;
  if (a.state === "suspended") void a.resume();
  if (id === "foghorn") {
    pulse(a, 165, 720, 0.7, "sine", 0);
    pulse(a, 220, 720, 0.45, "sawtooth", 0);
    return;
  }
  if (id === "bell") {
    pulse(a, 1760, 90, 0.6, "triangle", 0);
    pulse(a, 1320, 90, 0.55, "triangle", 110);
    pulse(a, 990, 110, 0.5, "triangle", 220);
    return;
  }
  pulse(a, 880, 260, 0.45, "square", 0);
  pulse(a, 660, 260, 0.4, "square", 300);
}

function periodMs(id: AlarmSoundId): number {
  if (id === "foghorn") return 1300;
  if (id === "bell") return 700;
  return 900;
}

export function stopAlarmTone() {
  loopingId = null;
  if (loopTimer != null) {
    window.clearInterval(loopTimer);
    loopTimer = null;
  }
  if (stopTimer != null) {
    window.clearTimeout(stopTimer);
    stopTimer = null;
  }
  for (const v of voices) {
    try {
      v.osc.stop();
    } catch {
      /* already stopped */
    }
    try {
      v.osc.disconnect();
      v.gain.disconnect();
    } catch {
      /* already gone */
    }
  }
  voices = [];
}

export function startAlarmTone(id: AlarmSoundId = "klaxon") {
  if (loopTimer != null && loopingId === id) return;
  stopAlarmTone();
  const a = audio();
  if (!a) return;
  loopingId = id;
  playCycle(id);
  loopTimer = window.setInterval(() => playCycle(id), periodMs(id));
}

export function previewAlarm(id: AlarmSoundId) {
  startAlarmTone(id);
  stopTimer = window.setTimeout(() => stopAlarmTone(), periodMs(id) * 2 + 200);
}
