/**
 * Backup file for moving tracks and settings to a new phone. Saved through the
 * share sheet (iCloud Drive, Google Drive, Files, email) and restored from a file.
 * The anchor watch itself is never restored from a backup.
 */
import type { LocalDraft } from "@/store/helm";

export const BACKUP_APP = "anchor-mate";
export const BACKUP_VERSION = 1;

/** Settings worth carrying over. Anything missing on restore keeps the current value. */
export const BACKUP_SETTING_KEYS = [
  "rode",
  "hull",
  "imagery",
  "labels",
  "graticule",
  "seamarks",
  "depths",
  "reefOutlines",
  "parkZones",
  "look",
  "autoNight",
  "sunPunch",
  "chartUp",
  "boatLow",
  "steerSense",
  "xteAlarmM",
  "steerEar",
  "trackTurnDeg",
  "trackChordM",
  "alarmSound",
  "gpsAlarmOn",
  "swingTrailOn",
  "crumbOn",
  "depthUnit",
  "lengthUnit",
  "wxLayers",
  "wxModels",
  "wxHorizonH",
  "radar",
  "sharpTiles",
  "depthLayer",
  "benthic",
  "textSize",
  "reefClarity",
  "routePrefs",
] as const;

export type BackupFile = {
  app: typeof BACKUP_APP;
  version: number;
  createdAt: string;
  tracks: LocalDraft[];
  settings: Record<string, unknown>;
};

export function makeBackup(state: Record<string, unknown> & { drafts: LocalDraft[] }, at = new Date()): BackupFile {
  const settings: Record<string, unknown> = {};
  for (const k of BACKUP_SETTING_KEYS) if (state[k] !== undefined) settings[k] = state[k];
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    createdAt: at.toISOString(),
    tracks: state.drafts,
    settings,
  };
}

function isDraft(v: unknown): v is LocalDraft {
  if (!v || typeof v !== "object") return false;
  const d = v as LocalDraft;
  return (
    typeof d.localId === "string" &&
    typeof d.title === "string" &&
    Array.isArray(d.waypoints) &&
    d.waypoints.length >= 1 &&
    d.waypoints.every((w) => w && Number.isFinite(w.lat) && Number.isFinite(w.lng))
  );
}

/** Parse and validate a backup. Throws a message a skipper can act on. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't an Anchor Mate backup.");
  }
  const b = raw as Partial<BackupFile>;
  if (!b || b.app !== BACKUP_APP) throw new Error("That file isn't an Anchor Mate backup.");
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) {
    throw new Error("This backup is from a newer Anchor Mate. Update the app, then try again.");
  }
  const tracks = Array.isArray(b.tracks) ? b.tracks.filter(isDraft) : [];
  const settings: Record<string, unknown> = {};
  if (b.settings && typeof b.settings === "object") {
    for (const k of BACKUP_SETTING_KEYS) {
      if (k in b.settings) settings[k] = (b.settings as Record<string, unknown>)[k];
    }
  }
  return {
    app: BACKUP_APP,
    version: b.version,
    createdAt: typeof b.createdAt === "string" ? b.createdAt : "",
    tracks: tracks.map((t) => ({
      localId: t.localId,
      title: t.title,
      region: typeof t.region === "string" ? t.region : "",
      notes: typeof t.notes === "string" ? t.notes : "",
      kind: t.kind === "anchorage" ? "anchorage" : "passage",
      waypoints: t.waypoints.map((w) => ({ lat: w.lat, lng: w.lng, ...(w.label ? { label: String(w.label) } : {}) })),
      savedAt: typeof t.savedAt === "string" ? t.savedAt : new Date().toISOString(),
    })),
    settings,
  };
}

/**
 * Add restored tracks to the phone's tracks. A track already on the phone (same id)
 * is kept as is; newest first; capped at `max`.
 */
export function mergeTracks(
  current: LocalDraft[],
  incoming: LocalDraft[],
  max = 40,
): { tracks: LocalDraft[]; added: number; dropped: number } {
  const have = new Set(current.map((d) => d.localId));
  const fresh = incoming.filter((d) => !have.has(d.localId));
  const all = [...current, ...fresh].sort((a, b) => (b.savedAt > a.savedAt ? 1 : b.savedAt < a.savedAt ? -1 : 0));
  return {
    tracks: all.slice(0, max),
    added: Math.min(fresh.length, Math.max(0, max - current.length)),
    dropped: Math.max(0, all.length - max),
  };
}

export function backupFileName(at = new Date()): string {
  return `anchor-mate-backup-${at.toISOString().slice(0, 10)}.json`;
}
