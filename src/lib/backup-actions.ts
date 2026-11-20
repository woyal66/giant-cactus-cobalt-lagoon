import { backupFileName, makeBackup, mergeTracks, parseBackup } from "@/lib/backup";
import { shareTextFile } from "@/lib/share-file";
import { flushHelmWrite, useHelm } from "@/store/helm";

function keepAnchor() {
  const a = useHelm.getState().anchor;
  return a?.demo ? null : a;
}

export async function saveBackup(): Promise<void> {
  const s = useHelm.getState() as unknown as Parameters<typeof makeBackup>[0];
  const file = makeBackup(s);
  await shareTextFile({
    fileName: backupFileName(),
    text: JSON.stringify(file, null, 1),
    mime: "application/json",
    title: "Save Anchor Mate backup",
  });
}

/**
 * Restore tracks and settings. Goes through the store's normal load path so every
 * value is validated exactly as on app start. The current anchor watch is kept.
 */
export function restoreBackup(text: string): { added: number; dropped: number } {
  const b = parseBackup(text);
  flushHelmWrite();
  const name = useHelm.persist.getOptions().name ?? "reefpilot-helm-v8";
  let saved: { state: Record<string, unknown>; version?: number } = { state: {} };
  try {
    saved = JSON.parse(localStorage.getItem(name) ?? "") ?? saved;
  } catch {
    /* nothing saved yet */
  }
  const merged = mergeTracks(useHelm.getState().drafts, b.tracks);
  const next = {
    ...saved,
    state: { ...saved.state, ...b.settings, drafts: merged.tracks, anchor: keepAnchor() },
  };
  localStorage.setItem(name, JSON.stringify(next));
  void useHelm.persist.rehydrate();
  return { added: merged.added, dropped: merged.dropped };
}
