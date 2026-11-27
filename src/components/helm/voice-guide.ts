import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";
import { followStart, markNav, nextTurn, steerCue, steerLegIndex } from "@/lib/steer";
import { getUnits } from "@/lib/units";
import { newVoiceMemory, voicePrompt, type VoiceMemory } from "@/lib/voice";
import { guidePoints, useHelm } from "@/store/helm";

let busyUntil = 0;

/**
 * Say a sentence with the phone's own voice. On the phone this is the system text-to-speech
 * (works with no signal once the voice is on the phone; iPhone plays it with the silent switch
 * on); in a browser, the Web Speech API. Never throws.
 */
export async function speak(text: string, urgent = false): Promise<void> {
  const lang = typeof navigator !== "undefined" && navigator.language?.startsWith("en") ? navigator.language : "en-AU";
  // Rough length so a non-urgent line doesn't cut off the one before.
  busyUntil = Date.now() + 600 + text.length * 70;
  if (isNativeApp()) {
    try {
      const { TextToSpeech, QueueStrategy } = await import("@capacitor-community/text-to-speech");
      await TextToSpeech.speak({ text, lang, rate: 1.0, category: "playback", queueStrategy: urgent ? QueueStrategy.Flush : QueueStrategy.Add });
      return;
    } catch {
      // Fall through to the web voice.
    }
  }
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (urgent) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    synth.speak(u);
  } catch {
    // No voice on this device.
  }
}

/** Spoken prompts while following a track: checks every 1.5 s, says at most one line. */
export function useVoiceGuide() {
  useEffect(() => {
    let mem: VoiceMemory = newVoiceMemory();
    let track: string | null = null;
    const tick = () => {
      const s = useHelm.getState();
      const id = s.activePassage ? `${s.activePassage.title}|${s.activePassage.waypoints.length}|${s.activePassage.waypoints[0]?.lat}` : null;
      if (id !== track) {
        track = id;
        mem = newVoiceMemory();
      }
      const boat = s.boat;
      if (!s.voiceOn || !s.activePassage || !boat || boat.source === "none" || s.mob || s.alarmOn || s.gpsLost) return;
      const pts = guidePoints(s.activePassage, s.crumb, { turnDeg: s.trackTurnDeg, chordM: s.trackChordM });
      if (pts.length < 2) return;
      // At the far end of a just-loaded track the app is asking "Follow reversed?": stay quiet till answered.
      if (!mem.started && followStart(boat, pts).reverse) return;
      const nav = markNav(boat, pts, s.pinnedMark, s.courseMark);
      if (!nav) return;
      const turn = nextTurn(boat, pts, nav.index);
      const cue = steerCue(boat, pts, s.steerSense, 0, steerLegIndex(boat, pts, nav.index));
      const r = voicePrompt(
        {
          index: nav.index,
          count: pts.length,
          toMarkM: nav.rangeM,
          turn,
          xteM: nav.index === 0 ? null : (cue?.xteM ?? null),
          speedMs: boat.speedMs ?? 0,
          now: Date.now(),
        },
        mem,
        getUnits().length,
      );
      if (!r.say) {
        mem = r.mem;
        return;
      }
      const urgent = /now|Arriving/.test(r.say);
      // Still speaking: hold a routine line for the next check (its memory isn't kept yet).
      if (!urgent && Date.now() < busyUntil) return;
      mem = r.mem;
      void speak(r.say, urgent);
    };
    const t = window.setInterval(tick, 1500);
    return () => window.clearInterval(t);
  }, []);
}
