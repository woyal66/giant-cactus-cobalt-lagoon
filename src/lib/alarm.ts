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
  gain.connect(a.destination);
  osc.start(t0);
  osc.stop(t1 + 0.04);
  voices.push({ osc, gain });
}

function playCycle(id: AlarmSoundId) {
  const a = audio();
  if (!a) return;
  if (a.state === "suspended") void a.resume();
  if (id === "foghorn") {
    pulse(a, 165, 720, 0.16, "sine", 0);
    pulse(a, 220, 720, 0.12, "sawtooth", 0);
    return;
  }
  if (id === "bell") {
    pulse(a, 1760, 90, 0.09, "triangle", 0);
    pulse(a, 1320, 90, 0.08, "triangle", 110);
    pulse(a, 990, 110, 0.07, "triangle", 220);
    return;
  }
  pulse(a, 880, 260, 0.09, "square", 0);
  pulse(a, 660, 260, 0.08, "square", 300);
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
