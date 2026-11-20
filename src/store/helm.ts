import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Passage, PassageKind, Waypoint } from "@/lib/passages";
import { DEFAULT_REEF_ID, getReef } from "@/lib/reefs";
import { isChartUp, type ChartUp, type LatLng, appendTrail, reverseCourse, reverseWaypoints, simplifyTrack, fitTrackView, haversineMeters, type TrackClean } from "@/lib/geo";
import { HELM_ZOOM, isImageryId, usableImagery, type ImageryId } from "@/lib/imagery";
import {
  isDepthUnit,
  isLengthUnit,
  setUnits,
  type DepthUnit,
  type LengthUnit,
} from "@/lib/units";
import { isTopic } from "@/lib/remote-watch";
import { boxShortM, squareFromCorners, type BBox, type OfflinePack } from "@/lib/offline-tiles";
import {
  clampAlarmRadius,
  clampRode,
  DEFAULT_RODE,
  hookAstern,
  rodeMath,
  appendSwingTrail,
  type RodeSetup,
} from "@/lib/anchor";
import { isAlarmSound, type AlarmSoundId } from "@/lib/alarm";
import {
  isSteerSense,
  type SteerSense,
} from "@/lib/steer";
import { clampWxHorizon } from "@/lib/weather";
import {
  bowFromGps,
  clampBoat,
  DEFAULT_BOAT,
  gpsReachM,
  type BoatSetup,
} from "@/lib/boat";

export type { ImageryId };
export type FixSource = "gps" | "last" | "demo" | "placed" | "none";
export type PanelId =
  | null
  | "atlas"
  | "passages"
  | "anchor"
  | "legend"
  | "save"
  | "layers"
  | "weather"
  | "boat";
export type DrawMode = "idle" | "record" | "draw";
export type LookMode = "normal" | "sunlight" | "night";

export type MobMark = { lat: number; lng: number; at: number };

export function isLookMode(v: unknown): v is LookMode {
  return v === "normal" || v === "sunlight" || v === "night";
}

export function nextLook(v: LookMode): LookMode {
  if (v === "normal") return "sunlight";
  if (v === "sunlight") return "night";
  return "normal";
}

export type BoatFix = {
  lat: number;
  lng: number;
  heading: number | null;
  speedMs: number;
  accuracy: number | null;
  source: FixSource;
  at: number;
};

export type AnchorWatch = {
  lat: number;
  lng: number;
  radiusM: number;
  droppedAt: number;
  radiusLocked: boolean;
  fence: LatLng[] | null;
  /** Temporary anchor for the first-run alarm demo. Never saved. */
  demo?: boolean;
};

export type LocalDraft = {
  localId: string;
  title: string;
  region: string;
  notes: string;
  kind: PassageKind;
  waypoints: Waypoint[];
  savedAt: string;
};

export type WxLayers = {
  wind: boolean;
  tide: boolean;
  current: boolean;
  waves: boolean;
};

export type WxModels = {
  ecmwf: boolean;
  gfs: boolean;
  ukmo: boolean;
  icon: boolean;
};

const DEFAULT_WX_LAYERS: WxLayers = { wind: true, tide: true, current: true, waves: true };
const DEFAULT_WX_MODELS: WxModels = { ecmwf: true, gfs: true, ukmo: false, icon: false };

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readWxLayers(value: unknown, fallback: WxLayers): WxLayers {
  const row = value && typeof value === "object" ? (value as Partial<WxLayers>) : {};
  const next = {
    wind: flag(row.wind, fallback.wind),
    tide: flag(row.tide, fallback.tide),
    current: flag(row.current, fallback.current),
    waves: flag(row.waves, fallback.waves),
  };
  return next.wind || next.tide || next.current || next.waves ? next : { ...DEFAULT_WX_LAYERS };
}

function readWxModels(value: unknown, fallback: WxModels): WxModels {
  const row = value && typeof value === "object" ? (value as Partial<WxModels>) : {};
  const next = {
    ecmwf: flag(row.ecmwf, fallback.ecmwf),
    gfs: flag(row.gfs, fallback.gfs),
    ukmo: flag(row.ukmo, fallback.ukmo),
    icon: flag(row.icon, fallback.icon),
  };
  return next.ecmwf || next.gfs || next.ukmo || next.icon ? next : { ...DEFAULT_WX_MODELS };
}

export type HelmState = {
  reefId: string;
  flyTo: { lat: number; lng: number; zoom: number; nonce: number; fit?: "track" } | null;
  boat: BoatFix | null;
  lastFix: BoatFix | null;
  followBoat: boolean;
  /** While following, hold the boat just below screen centre. */
  boatLow: boolean;
  chartUp: ChartUp;
  imagery: ImageryId;
  labels: boolean;
  /** Latitude and longitude grid. */
  graticule: boolean;
  seamarks: boolean;
  depths: boolean;
  /** GBRMPA reef / cay / rock outlines overlay. */
  reefOutlines: boolean;
  /** GBR Marine Park zoning overlay. */
  parkZones: boolean;
  panel: PanelId;
  /** Forecast pin. Null means the forecast is for the boat. */
  wxPin: LatLng | null;
  drawMode: DrawMode;
  draft: Waypoint[];
  activePassage: Passage | LocalDraft | null;
  anchor: AnchorWatch | null;
  alarmOn: boolean;
  alarmMuted: boolean;
  trackAlarm: boolean;
  gpsLost: boolean;
  /** False means a dead fix does not alarm. Remembered. */
  gpsAlarmOn: boolean;
  /** This GPS-lost warning was closed. Clears when a good fix returns. */
  gpsLostAck: boolean;
  steerSense: SteerSense;
  xteAlarmM: number;
  /** Soft tick on the line. Side cue past 2 m. */
  steerEar: boolean;
  /** A bend this sharp is kept when a track is cleaned. */
  trackTurnDeg: number;
  /** A point this far off a straight is kept when a track is cleaned. */
  trackChordM: number;
  demoPlaying: boolean;
  introOpen: boolean;
  drafts: LocalDraft[];
  gpsDenied: boolean;
  tapMode: "none" | "place-boat" | "drop-anchor" | "resize-swing" | "draw-fence" | "draw-pack";
  hookPreview: LatLng | null;
  /** Tap the chart to place the boat, then drop the hook. Not persisted. */
  hookArmed: boolean;
  /** Set-anchor wizard. Not persisted. Alarm stays off until the last confirm. */
  anchorStep: "place" | "depth" | "chain" | "scope" | "circle" | "watch" | null;
  /** Circle being dragged, before the alarm is armed. Not persisted. */
  circleDraft: { lat: number; lng: number; radiusM: number } | null;
  /** Swing area while setting the hook. Not persisted. */
  swingShape: "circle" | "draw";
  fenceDraft: LatLng[];
  chartZoom: number;
  sunlight: boolean;
  look: LookMode;
  /** Switch to night (red) view at sunset and back at sunrise. */
  autoNight: boolean;
  depthUnit: DepthUnit;
  lengthUnit: LengthUnit;
  /** First-run guide finished or skipped. */
  guideDone: boolean;
  /** Second phone pairing for remote watch (ntfy topic). */
  remoteWatch: { topic: string; boatName: string } | null;
  sunPunch: 1 | 2 | 3;
  rode: RodeSetup;
  hull: BoatSetup;
  alarmSound: AlarmSoundId;
  wxHorizonH: number;
  /** Forecast chips the sailor last left on. Kept across close, pin and reload. */
  wxLayers: WxLayers;
  wxModels: WxModels;
  swingTrail: LatLng[];
  swingTrailOn: boolean;
  crumb: LatLng[];
  crumbOn: boolean;
  packDraft: LatLng[];
  packBox: BBox | null;
  offlinePacks: OfflinePack[];
  pinnedMark: number | null;
  /** Furthest course mark reached. Only moves forward until the track is reloaded or reversed. */
  courseMark: number;
  mob: MobMark | null;
  mobMuted: boolean;
};

type HelmActions = {
  setReef: (id: string) => void;
  fly: (lat: number, lng: number, zoom: number) => void;
  setBoat: (fix: BoatFix | null) => void;
  setFollowBoat: (v: boolean) => void;
  setBoatLow: (v: boolean) => void;
  cycleChartLock: () => void;
  /** One control: boat low, heading-up, ear on. Tap again to let the chart go. */
  followCourse: () => void;
  setChartUp: (v: ChartUp) => void;
  setImagery: (imagery: ImageryId) => void;
  setLabels: (v: boolean) => void;
  setGraticule: (v: boolean) => void;
  setSeamarks: (v: boolean) => void;
  setDepths: (v: boolean) => void;
  setReefOutlines: (v: boolean) => void;
  setParkZones: (v: boolean) => void;
  setPanel: (panel: PanelId) => void;
  setWxPin: (p: LatLng | null) => void;
  setDrawMode: (mode: DrawMode) => void;
  finishRecording: () => boolean;
  setDraft: (wps: Waypoint[]) => void;
  appendDraft: (wp: Waypoint) => void;
  popDraft: () => void;
  setActivePassage: (p: Passage | LocalDraft | null) => void;
  dropAnchor: (lat: number, lng: number, radiusM?: number) => void;
  moveAnchor: (lat: number, lng: number) => void;
  startPlaceHook: () => void;
  setHookNow: () => void;
  beginAnchorSet: () => void;
  cancelAnchorSet: () => void;
  setAnchorStep: (step: HelmState["anchorStep"]) => void;
  setCircleDraft: (p: { lat: number; lng: number; radiusM?: number } | null) => void;
  setSwingShape: (shape: "circle" | "draw") => void;
  setFenceDraft: (pts: LatLng[]) => void;
  undoCircle: () => void;
  acceptCircle: () => void;
  confirmAnchorAlarm: () => void;
  cancelPlaceHook: () => void;
  setHookPreview: (p: LatLng | null) => void;
  setAnchorRadius: (radiusM: number, locked?: boolean) => void;
  startResizeSwing: () => void;
  startDrawFence: () => void;
  appendFencePoint: (p: LatLng) => void;
  popFencePoint: () => void;
  commitFence: () => void;
  clearFence: () => void;
  weighAnchor: () => void;
  setAlarmOn: (v: boolean) => void;
  setAlarmMuted: (v: boolean) => void;
  setTrackAlarm: (v: boolean) => void;
  setGpsLost: (v: boolean) => void;
  setGpsAlarmOn: (v: boolean) => void;
  ackGpsLost: () => void;
  clearGpsLostAck: () => void;
  setSteerSense: (v: SteerSense) => void;
  setXteAlarmM: (m: number) => void;
  setSteerEar: (v: boolean) => void;
  setTrackTurnDeg: (deg: number) => void;
  setTrackChordM: (m: number) => void;
  setDemoPlaying: (v: boolean) => void;
  dismissIntro: () => void;
  saveDraft: (draft: Omit<LocalDraft, "localId" | "savedAt">) => LocalDraft;
  removeDraft: (localId: string) => void;
  setGpsDenied: (v: boolean) => void;
  setTapMode: (mode: HelmState["tapMode"]) => void;
  setChartZoom: (z: number) => void;
  setSunlight: (v: boolean) => void;
  setLook: (v: LookMode) => void;
  setAutoNight: (v: boolean) => void;
  setDepthUnit: (v: DepthUnit) => void;
  setGuideDone: (v: boolean) => void;
  setRemoteWatch: (v: { topic: string; boatName: string } | null) => void;
  setLengthUnit: (v: LengthUnit) => void;
  cycleLook: () => void;
  setSunPunch: (n: 1 | 2 | 3) => void;
  setRode: (partial: Partial<RodeSetup>) => void;
  setHull: (partial: Partial<BoatSetup>) => void;
  setAlarmSound: (id: AlarmSoundId) => void;
  setWxHorizonH: (h: number) => void;
  setWxLayers: (layers: WxLayers) => void;
  setWxModels: (models: WxModels) => void;
  setSwingTrailOn: (v: boolean) => void;
  setCrumbOn: (v: boolean) => void;
  clearCrumb: () => void;
  reverseTrack: () => boolean;
  startDrawPack: () => void;
  appendPackCorner: (p: LatLng) => void;
  setPackDrag: (a: LatLng, b: LatLng | null) => void;
  commitPackBox: () => boolean;
  popPackCorner: () => void;
  clearPackBox: () => void;
  setPackBox: (b: BBox | null) => void;
  setOfflinePacks: (packs: OfflinePack[]) => void;
  setPinnedMark: (i: number | null) => void;
  setCourseMark: (n: number) => void;
  dropMob: () => boolean;
  clearMob: () => void;
  setMobMuted: (v: boolean) => void;
};

function isBoatFix(v: unknown): v is BoatFix {
  if (!v || typeof v !== "object") return false;
  const f = v as BoatFix;
  return Number.isFinite(f.lat) && Number.isFinite(f.lng);
}

function isMobMark(v: unknown): v is MobMark {
  if (!v || typeof v !== "object") return false;
  const m = v as MobMark;
  return Number.isFinite(m.lat) && Number.isFinite(m.lng);
}

function asLastKnown(fix: BoatFix): BoatFix {
  return {
    ...fix,
    source: "last",
    speedMs: 0,
  };
}

function bowOf(fix: BoatFix | null, hull: BoatSetup): LatLng | null {
  if (!fix) return null;
  return bowFromGps(fix, fix.heading, hull);
}

function watchRadius(rode: RodeSetup, hull: BoatSetup): number {
  return rodeMath(rode, gpsReachM(hull)).radiusM;
}

function reefOpen(id: string) {
  const reef = getReef(id);
  return { lat: reef.lat, lng: reef.lng, zoom: reef.zoom, nonce: 1 };
}

function ghostHook(fix: BoatFix | null, hull: BoatSetup, rode: RodeSetup): LatLng | null {
  const bow = bowOf(fix, hull);
  if (!bow || !fix) return null;
  return hookAstern({ ...bow, heading: fix.heading }, rode);
}

const FIX_KEEP_M = 50;
const FIX_KEEP_MS = 60_000;

function keepSavedFix(prev: BoatFix | null, next: BoatFix): boolean {
  if (next.source === "placed") return true;
  if (next.source !== "gps") return false;
  if (!prev) return true;
  if (haversineMeters(prev, next) >= FIX_KEEP_M) return true;
  const at = Number.isFinite(next.at) ? next.at : Date.now();
  const prevAt = Number.isFinite(prev.at) ? prev.at : 0;
  return at - prevAt >= FIX_KEEP_MS;
}

const persistIds = new WeakMap<object, number>();
let persistSeq = 1;
function persistId(v: unknown): number {
  if (!v || typeof v !== "object") return 0;
  let id = persistIds.get(v);
  if (!id) {
    id = persistSeq++;
    persistIds.set(v, id);
  }
  return id;
}

function persistSig(state: Record<string, unknown>): string {
  const fix = state.lastFix as BoatFix | null;
  return [
    state.imagery,
    state.labels,
    state.graticule,
    state.seamarks,
    state.depths,
    state.reefOutlines,
    state.parkZones,
    state.sunlight,
    state.look,
    state.autoNight,
    state.depthUnit,
    state.guideDone,
    persistId(state.remoteWatch),
    state.lengthUnit,
    state.sunPunch,
    state.chartUp,
    state.boatLow,
    state.steerSense,
    state.xteAlarmM,
    state.steerEar,
    state.trackTurnDeg,
    state.trackChordM,
    state.alarmSound,
    state.gpsAlarmOn,
    state.wxHorizonH,
    state.swingTrailOn,
    state.crumbOn,
    persistId(state.drafts),
    persistId(state.lastFix),
    fix?.lat,
    fix?.lng,
    fix?.at,
    persistId(state.rode),
    persistId(state.hull),
    persistId(state.wxLayers),
    persistId(state.wxModels),
    persistId(state.crumb),
    persistId(state.mob),
    persistId(state.anchor),
  ].join("|");
}

let savedPersistSig = "";
let savedAnchorId = -1;
let pendingWrite: { name: string; value: { state: unknown; version?: number } } | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
/** Settings and tracks are saved at most this often; the anchor is saved at once. */
const PERSIST_DEBOUNCE_MS = 4_000;

export function flushHelmWrite() {
  if (writeTimer != null) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  const w = pendingWrite;
  pendingWrite = null;
  if (!w || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(w.name, JSON.stringify(w.value));
  } catch {
    /* quota exceeded or storage blocked: keep running, the watch is in memory */
  }
}

if (typeof document !== "undefined") {
  // The OS may kill a backgrounded app without warning: write before that can happen.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushHelmWrite();
  });
  window.addEventListener("pagehide", flushHelmWrite);
}

export function isAnchorWatch(v: unknown): v is AnchorWatch {
  if (!v || typeof v !== "object") return false;
  const a = v as AnchorWatch;
  const okFence =
    a.fence === null ||
    (Array.isArray(a.fence) &&
      a.fence.every((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)));
  return (
    Number.isFinite(a.lat) &&
    Number.isFinite(a.lng) &&
    Number.isFinite(a.radiusM) &&
    a.radiusM > 0 &&
    Number.isFinite(a.droppedAt) &&
    typeof a.radiusLocked === "boolean" &&
    okFence
  );
}

const helmStorage = {
  getItem: (name: string) => {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { state: unknown; version?: number };
      if (!parsed || typeof parsed !== "object" || !("state" in parsed)) return null;
      if (parsed.state && typeof parsed.state === "object") {
        savedPersistSig = persistSig(parsed.state as Record<string, unknown>);
      }
      return parsed;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: { state: unknown; version?: number }) => {
    if (typeof localStorage === "undefined") return;
    const state = value.state;
    if (!state || typeof state !== "object") return;
    const sig = persistSig(state as Record<string, unknown>);
    if (sig === savedPersistSig) return;
    savedPersistSig = sig;
    pendingWrite = { name, value };
    const anchorId = persistId((state as { anchor?: unknown }).anchor);
    if (anchorId !== savedAnchorId) {
      savedAnchorId = anchorId;
      flushHelmWrite();
      return;
    }
    writeTimer ??= setTimeout(flushHelmWrite, PERSIST_DEBOUNCE_MS);
  },
  removeItem: (name: string) => {
    savedPersistSig = "";
    pendingWrite = null;
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(name);
  },
};

/** Restore a saved unit and make the formatters use it. */
function applyDepthUnit(v: unknown, fallback: DepthUnit): DepthUnit {
  const u = isDepthUnit(v) ? v : fallback;
  setUnits({ depth: u });
  return u;
}

function applyLengthUnit(v: unknown, fallback: LengthUnit): LengthUnit {
  const u = isLengthUnit(v) ? v : fallback;
  setUnits({ length: u });
  return u;
}

export const useHelm = create<HelmState & HelmActions>()(
  persist(
    (set, get) => ({
      reefId: DEFAULT_REEF_ID,
      flyTo: reefOpen(DEFAULT_REEF_ID),
      boat: null,
      lastFix: null,
      followBoat: false,
      boatLow: false,
      chartUp: "north",
      imagery: "auto",
      labels: true,
      graticule: false,
      seamarks: false,
      depths: false,
      reefOutlines: false,
      parkZones: false,
      panel: null,
      drawMode: "idle",
      draft: [],
      activePassage: null,
      anchor: null,
      alarmOn: false,
      alarmMuted: false,
      trackAlarm: false,
      gpsLost: false,
      gpsAlarmOn: true,
      gpsLostAck: false,
      steerSense: "cut",
      xteAlarmM: 1,
      steerEar: true,
      trackTurnDeg: 30,
      trackChordM: 8,
      demoPlaying: false,
      introOpen: false,
      drafts: [],
      gpsDenied: false,
      tapMode: "none",
      wxPin: null,
      hookPreview: null,
      hookArmed: false,
      anchorStep: null,
      circleDraft: null,
      swingShape: "circle",
      fenceDraft: [],
      chartZoom: 3,
      sunlight: false,
      look: "normal",
      autoNight: false,
      depthUnit: "m",
      guideDone: false,
      remoteWatch: null,
      lengthUnit: "m",
      sunPunch: 2,
      rode: DEFAULT_RODE,
      hull: DEFAULT_BOAT,
      alarmSound: "klaxon",
      wxHorizonH: 48,
      wxLayers: { ...DEFAULT_WX_LAYERS },
      wxModels: { ...DEFAULT_WX_MODELS },
      swingTrail: [],
      swingTrailOn: true,
      crumb: [],
      crumbOn: true,
      packDraft: [],
      packBox: null,
      offlinePacks: [],
      pinnedMark: null,
      courseMark: 0,
      mob: null,
      mobMuted: false,

      setReef: (id) => {
        const reef = getReef(id);
        set({
          reefId: id,
          flyTo: { lat: reef.lat, lng: reef.lng, zoom: reef.zoom, nonce: Date.now() },
          followBoat: false,
          panel: null,
        });
      },
      fly: (lat, lng, zoom) =>
        set({ flyTo: { lat, lng, zoom, nonce: Date.now() } }),
      setBoat: (fix) => {
        const s = get();
        const lastFix = fix && keepSavedFix(s.lastFix, fix) ? fix : s.lastFix;
        let swingTrail = s.swingTrail;
        if (fix && s.anchor?.radiusLocked && s.swingTrailOn) {
          swingTrail = appendSwingTrail(swingTrail, fix);
        }
        let crumb = s.crumb;
        if (
          fix &&
          s.drawMode === "record" &&
          s.crumbOn &&
          (fix.source === "gps" || fix.source === "demo")
        ) {
          crumb = appendTrail(crumb, fix, 2);
        }
        if (
          fix === s.boat &&
          lastFix === s.lastFix &&
          swingTrail === s.swingTrail &&
          crumb === s.crumb
        ) {
          return;
        }
        set({ boat: fix, lastFix, swingTrail, crumb });
      },
      setFollowBoat: (v) => set({ followBoat: v }),
      setBoatLow: (boatLow) =>
        set({ boatLow, followBoat: boatLow ? true : get().followBoat }),
      cycleChartLock: () => {
        const s = get();
        if (!s.followBoat) {
          set({ followBoat: true });
          return;
        }
        if (s.chartUp !== "heading") {
          set({ followBoat: true, chartUp: "heading", boatLow: true });
          return;
        }
        set({ followBoat: true, chartUp: "north", boatLow: false });
      },
      followCourse: () => {
        const s = get();
        const tracking = Boolean(s.activePassage && s.activePassage.waypoints.length >= 2);
        const engaged =
          s.followBoat && s.chartUp === "heading" && (!tracking || s.boatLow);
        if (engaged) {
          set({ followBoat: false });
          return;
        }
        set({
          followBoat: true,
          chartUp: "heading",
          boatLow: tracking ? true : s.boatLow,
          steerEar: tracking ? true : s.steerEar,
          panel: null,
        });
      },
      setChartUp: (chartUp) => set({ chartUp }),
      setImagery: (imagery) => set({ imagery }),
      setLabels: (labels) => set({ labels }),
      setGraticule: (graticule) => set({ graticule }),
      setSeamarks: (v) => set({ seamarks: v }),
      setDepths: (v) => set({ depths: v }),
      setReefOutlines: (v) => set({ reefOutlines: v }),
      setParkZones: (v) => set({ parkZones: v }),
      setPanel: (panel) => set({ panel }),
      setWxPin: (wxPin) => set({ wxPin }),
      setDrawMode: (drawMode) => {
        const s = get();
        const seed =
          drawMode === "record" && s.draft.length === 0 && s.boat
            ? [{ lat: s.boat.lat, lng: s.boat.lng, label: "Start" } as Waypoint]
            : s.draft;
        set({
          drawMode,
          draft: seed,
          tapMode: drawMode === "draw" ? "none" : s.tapMode,
          followBoat: drawMode === "record" ? true : s.followBoat,
        });
      },
      finishRecording: () => {
        const s = get();
        if (s.drawMode !== "record") return false;
        const pts = [...s.draft];
        const boat = s.boat;
        const last = pts[pts.length - 1];
        if (boat && (!last || haversineMeters(last, boat) >= 2)) {
          pts.push({ lat: boat.lat, lng: boat.lng });
        }
        if (pts.length < 2) {
          set({ drawMode: "idle", draft: [] });
          return false;
        }
        const clean = simplifyTrack(pts, {
          turnDeg: s.trackTurnDeg,
          chordM: s.trackChordM,
        });
        const waypoints = clean.map((w, i) => ({
          lat: w.lat,
          lng: w.lng,
          label: i === 0 ? "Start" : i === clean.length - 1 ? "Stop" : `WP ${i + 1}`,
        }));
        const recorded: LocalDraft = {
          localId: `rec-${Date.now()}`,
          title: "Start to stop",
          region: "",
          notes: "Recorded from the start to the stop.",
          kind: "passage",
          waypoints,
          savedAt: new Date().toISOString(),
        };
        set({
          drafts: [recorded, ...s.drafts].slice(0, 40),
          activePassage: recorded,
          draft: [],
          drawMode: "idle",
          panel: null,
          courseMark: 0,
          pinnedMark: null,
          followBoat: true,
        });
        return true;
      },
      setDraft: (draft) => set({ draft }),
      appendDraft: (wp) => set({ draft: [...get().draft, wp] }),
      popDraft: () => set({ draft: get().draft.slice(0, -1) }),
      setActivePassage: (activePassage) => {
        const pts = activePassage?.waypoints ?? [];
        const fit = pts.length >= 2 ? fitTrackView(pts) : null;
        const point = pts[0];
        set({
          activePassage,
          pinnedMark: null,
          courseMark: 0,
          panel: null,
          followBoat: pts.length >= 2 ? false : get().followBoat,
          flyTo: fit
            ? { ...fit, fit: "track", nonce: Date.now() }
            : point
              ? { lat: point.lat, lng: point.lng, zoom: 17, nonce: Date.now() }
              : get().flyTo,
        });
      },
      dropAnchor: (lat, lng, radiusM) => {
        const radius = radiusM ?? watchRadius(get().rode, get().hull);
        const boat = get().boat;
        set({
          anchor: {
            lat,
            lng,
            radiusM: radius,
            droppedAt: Date.now(),
            radiusLocked: false,
            fence: null,
          },
          alarmOn: false,
          alarmMuted: false,
          panel: null,
          tapMode: "none",
          hookPreview: null,
          fenceDraft: [],
          swingTrail: boat ? [{ lat: boat.lat, lng: boat.lng }] : [],
          swingTrailOn: get().swingTrailOn,
        });
      },
      moveAnchor: (lat, lng) => {
        const a = get().anchor;
        if (!a || a.radiusLocked) return;
        set({
          anchor: { ...a, lat, lng },
          hookPreview: null,
        });
      },
      startPlaceHook: () => {
        const s = get();
        if (!s.boat) {
          set({ tapMode: "place-boat", panel: null, hookPreview: null, hookArmed: false, fenceDraft: [] });
          return;
        }
        set({
          tapMode: "drop-anchor",
          panel: null,
          followBoat: false,
          hookArmed: false,
          hookPreview: ghostHook(s.boat, s.hull, s.rode),
          fenceDraft: [],
          flyTo: {
            lat: s.boat.lat,
            lng: s.boat.lng,
            zoom: Math.max(s.chartZoom, HELM_ZOOM),
            nonce: Date.now(),
          },
        });
      },
      setHookNow: () => {
        const s = get();
        if (!s.boat) {
          set({
            tapMode: "place-boat",
            panel: null,
            hookPreview: null,
            hookArmed: true,
            fenceDraft: [],
          });
          return;
        }
        const hook = ghostHook(s.boat, s.hull, s.rode);
        if (!hook) {
          set({ tapMode: "place-boat", panel: null, hookArmed: true, hookPreview: null });
          return;
        }
        set({
          anchor: {
            lat: hook.lat,
            lng: hook.lng,
            radiusM: watchRadius(s.rode, s.hull),
            droppedAt: Date.now(),
            radiusLocked: false,
            fence: null,
          },
          alarmOn: false,
          alarmMuted: false,
          panel: "anchor",
          tapMode: "none",
          hookPreview: null,
          hookArmed: false,
          fenceDraft: [],
          followBoat: false,
          swingTrail: [{ lat: s.boat.lat, lng: s.boat.lng }],
          flyTo: {
            lat: s.boat.lat,
            lng: s.boat.lng,
            zoom: Math.max(s.chartZoom, HELM_ZOOM),
            nonce: Date.now(),
          },
        });
      },
      beginAnchorSet: () => {
        const s = get();
        if (s.anchor) return;
        const fix = s.boat ?? s.lastFix;
        if (!fix) {
          set({
            anchorStep: "place",
            tapMode: "place-boat",
            panel: null,
            hookArmed: false,
            hookPreview: null,
            circleDraft: null,
            swingShape: "circle",
            fenceDraft: [],
            followBoat: false,
          });
          return;
        }
        set({
          boat: s.boat ?? asLastKnown(fix),
          anchorStep: "depth",
          tapMode: "none",
          panel: null,
          hookArmed: false,
          hookPreview: null,
          circleDraft: null,
          swingShape: "circle",
          fenceDraft: [],
          followBoat: false,
        });
      },
      cancelAnchorSet: () =>
        set({
          anchorStep: null,
          circleDraft: null,
          swingShape: "circle",
          fenceDraft: [],
          hookPreview: null,
          hookArmed: false,
          tapMode: "none",
          panel: null,
        }),
      setAnchorStep: (anchorStep) => set({ anchorStep, panel: null }),
      setCircleDraft: (p) => {
        if (!p) {
          set({ circleDraft: null, hookPreview: null });
          return;
        }
        const radiusM =
          p.radiusM ?? get().circleDraft?.radiusM ?? watchRadius(get().rode, get().hull);
        set({
          circleDraft: { lat: p.lat, lng: p.lng, radiusM },
          hookPreview: { lat: p.lat, lng: p.lng },
        });
      },
      setSwingShape: (swingShape) =>
        set(swingShape === "circle" ? { swingShape, fenceDraft: [] } : { swingShape }),
      setFenceDraft: (fenceDraft) => set({ fenceDraft }),
      undoCircle: () => {
        const s = get();
        const hook = s.boat ? ghostHook(s.boat, s.hull, s.rode) : null;
        const radiusM = watchRadius(s.rode, s.hull);
        set({
          anchorStep: "circle",
          tapMode: "drop-anchor",
          panel: null,
          followBoat: false,
          circleDraft: hook ? { lat: hook.lat, lng: hook.lng, radiusM } : null,
          hookPreview: hook,
          swingShape: "circle",
          fenceDraft: [],
        });
      },
      acceptCircle: () => {
        const s = get();
        const drawn = s.swingShape === "draw" && s.fenceDraft.length >= 3;
        if (!drawn && !s.circleDraft) return;
        if (s.swingShape === "draw" && !drawn) return;
        set({ anchorStep: "watch", tapMode: "none", panel: null });
      },
      confirmAnchorAlarm: () => {
        const s = get();
        const drawn = s.swingShape === "draw" && s.fenceDraft.length >= 3 ? s.fenceDraft : null;
        const d =
          s.circleDraft ??
          (drawn
            ? {
                lat: drawn.reduce((n, p) => n + p.lat, 0) / drawn.length,
                lng: drawn.reduce((n, p) => n + p.lng, 0) / drawn.length,
                radiusM: 40,
              }
            : null);
        if (!d) return;
        set({
          anchor: {
            lat: d.lat,
            lng: d.lng,
            radiusM: d.radiusM,
            droppedAt: Date.now(),
            radiusLocked: true,
            fence: drawn,
          },
          alarmOn: false,
          alarmMuted: false,
          panel: null,
          tapMode: "none",
          hookPreview: null,
          circleDraft: null,
          swingShape: "circle",
          anchorStep: null,
          hookArmed: false,
          fenceDraft: [],
          followBoat: false,
          swingTrail: s.boat ? [{ lat: s.boat.lat, lng: s.boat.lng }] : [],
          swingTrailOn: true,
        });
      },
      cancelPlaceHook: () =>
        set({ tapMode: "none", hookPreview: null, hookArmed: false, fenceDraft: [], packDraft: [] }),
      setHookPreview: (hookPreview) => set({ hookPreview }),
      setAnchorRadius: (radiusM, locked = true) => {
        const a = get().anchor;
        if (!a) return;
        set({
          anchor: {
            ...a,
            radiusM: clampAlarmRadius(radiusM),
            radiusLocked: locked,
          },
        });
      },
      startResizeSwing: () => {
        if (!get().anchor) return;
        set({
          tapMode: "resize-swing",
          panel: null,
          followBoat: false,
          fenceDraft: [],
        });
      },
      startDrawFence: () => {
        if (!get().anchor) return;
        set({
          tapMode: "draw-fence",
          panel: null,
          followBoat: false,
          fenceDraft: [],
        });
      },
      appendFencePoint: (p) =>
        set({ fenceDraft: [...get().fenceDraft, p] }),
      popFencePoint: () =>
        set({ fenceDraft: get().fenceDraft.slice(0, -1) }),
      commitFence: () => {
        const a = get().anchor;
        const draft = get().fenceDraft;
        if (!a || draft.length < 3) return;
        set({
          anchor: { ...a, fence: draft },
          fenceDraft: [],
          tapMode: "none",
        });
      },
      clearFence: () => {
        const a = get().anchor;
        if (!a) return;
        set({ anchor: { ...a, fence: null }, fenceDraft: [] });
      },
      weighAnchor: () =>
        set({
          anchor: null,
          alarmOn: false,
          alarmMuted: false,
          gpsLost: false,
          gpsLostAck: false,
          panel: null,
          hookPreview: null,
          hookArmed: false,
          anchorStep: null,
          circleDraft: null,
          fenceDraft: [],
          tapMode: "none",
          swingTrail: [],
        }),
      setAlarmOn: (alarmOn) => set({ alarmOn }),
      setAlarmMuted: (alarmMuted) => set({ alarmMuted }),
      setTrackAlarm: (trackAlarm) => set({ trackAlarm }),
      setGpsLost: (gpsLost) => set({ gpsLost }),
      setGpsAlarmOn: (gpsAlarmOn) =>
        set(
          gpsAlarmOn
            ? { gpsAlarmOn, gpsLostAck: false }
            : { gpsAlarmOn, gpsLost: false, gpsLostAck: true },
        ),
      ackGpsLost: () => set({ gpsLost: false, gpsLostAck: true }),
      clearGpsLostAck: () => set({ gpsLostAck: false }),
      setSteerSense: (steerSense) => set({ steerSense }),
      setXteAlarmM: (m) =>
        set({ xteAlarmM: Math.max(0, Math.min(200, Math.round(m))) }),
      setSteerEar: (steerEar) => set({ steerEar }),
      setTrackTurnDeg: (deg) =>
        set({
          trackTurnDeg: Math.max(5, Math.min(90, Math.round(deg))),
          courseMark: 0,
          pinnedMark: null,
        }),
      setTrackChordM: (m) =>
        set({
          trackChordM: Math.max(1, Math.min(80, Math.round(m))),
          courseMark: 0,
          pinnedMark: null,
        }),
      setDemoPlaying: (demoPlaying) =>
        set({ demoPlaying, followBoat: demoPlaying ? true : get().followBoat }),
      dismissIntro: () => set({ introOpen: false }),
      saveDraft: (input) => {
        const waypoints = simplifyTrack(input.waypoints, {
          turnDeg: get().trackTurnDeg,
          chordM: get().trackChordM,
        }).map((w, i) => ({
          lat: w.lat,
          lng: w.lng,
          label:
            w.label && !/^WP \d+$/.test(w.label.trim()) ? w.label : `WP ${i + 1}`,
        }));
        const draft: LocalDraft = {
          ...input,
          waypoints,
          localId: `local-${Date.now()}`,
          savedAt: new Date().toISOString(),
        };
        set({
          drafts: [draft, ...get().drafts].slice(0, 40),
          panel: null,
          drawMode: "idle",
          draft: [],
        });
        return draft;
      },
      removeDraft: (localId) =>
        set({ drafts: get().drafts.filter((d) => d.localId !== localId) }),
      setGpsDenied: (gpsDenied) => set({ gpsDenied }),
      setTapMode: (tapMode) =>
        set({ tapMode, drawMode: tapMode === "none" ? get().drawMode : "idle" }),
      setChartZoom: (chartZoom) => {
        if (get().chartZoom === chartZoom) return;
        set({ chartZoom });
      },
      setSunlight: (sunlight) =>
        set({ sunlight, look: sunlight ? "sunlight" : "normal" }),
      setLook: (look) => set({ look, sunlight: look === "sunlight" }),
      setAutoNight: (autoNight) => set({ autoNight }),
      setGuideDone: (guideDone) => set({ guideDone }),
      setRemoteWatch: (remoteWatch) => set({ remoteWatch }),
      setDepthUnit: (depthUnit) => {
        setUnits({ depth: depthUnit });
        set({ depthUnit });
      },
      setLengthUnit: (lengthUnit) => {
        setUnits({ length: lengthUnit });
        set({ lengthUnit });
      },
      cycleLook: () => {
        const look = nextLook(get().look);
        set({ look, sunlight: look === "sunlight" });
      },
      setSunPunch: (sunPunch) => set({ sunPunch, sunlight: true, look: "sunlight" }),
      setRode: (partial) => {
        const rode = clampRode({ ...get().rode, ...partial }, get().rode);
        const hull = clampBoat({
          ...get().hull,
          loaM: rode.loaM,
          bowM: rode.bowM,
        });
        const a = get().anchor;
        const placing = get().tapMode === "drop-anchor";
        const boat = get().boat;
        set({
          rode,
          hull,
          anchor: a
            ? a.radiusLocked || (a.fence && a.fence.length >= 3)
              ? a
              : { ...a, radiusM: watchRadius(rode, hull) }
            : a,
          hookPreview: placing ? ghostHook(boat, hull, rode) : get().hookPreview,
        });
      },
      setHull: (partial) => {
        const hull = clampBoat({ ...get().hull, ...partial }, get().hull);
        const rode = clampRode({
          ...get().rode,
          loaM: hull.loaM,
          bowM: hull.bowM,
        });
        const a = get().anchor;
        const placing = get().tapMode === "drop-anchor";
        const boat = get().boat;
        set({
          hull,
          rode,
          anchor: a
            ? a.radiusLocked || (a.fence && a.fence.length >= 3)
              ? a
              : { ...a, radiusM: watchRadius(rode, hull) }
            : a,
          hookPreview: placing ? ghostHook(boat, hull, rode) : get().hookPreview,
        });
      },
      setAlarmSound: (alarmSound) => set({ alarmSound }),
      setWxHorizonH: (h) => set({ wxHorizonH: clampWxHorizon(h) }),
      setWxLayers: (wxLayers) => set({ wxLayers }),
      setWxModels: (wxModels) => set({ wxModels }),
      setSwingTrailOn: (swingTrailOn) => set({ swingTrailOn }),
      setCrumbOn: (crumbOn) => set({ crumbOn }),
      clearCrumb: () => set({ crumb: [] }),
      reverseTrack: () => {
        const s = get();
        const fromDraft = s.drawMode !== "idle" && s.draft.length >= 2;
        const fromPassage = Boolean(
          !fromDraft && s.activePassage && s.activePassage.waypoints.length >= 2,
        );
        const src = fromDraft
          ? s.draft
          : fromPassage
            ? s.activePassage!.waypoints
            : s.crumb;
        if (src.length < 2) return false;
        if (fromPassage && s.activePassage) {
          const p = s.activePassage;
          const back = p.title.endsWith("· back");
          set({
            activePassage: {
              ...p,
              title: back ? p.title.replace(/\s· back$/, "") : `${p.title} · back`,
              waypoints: reverseCourse(p.waypoints, {
                turnDeg: s.trackTurnDeg,
                chordM: s.trackChordM,
              }),
            },
            pinnedMark: null,
            courseMark: 0,
            drawMode: "idle",
            followBoat: true,
            chartUp: "heading",
            panel: null,
          });
          return true;
        }
        const waypoints = reverseWaypoints(src, {
          turnDeg: s.trackTurnDeg,
          chordM: s.trackChordM,
        });
        const title = fromPassage
          ? s.activePassage!.title.endsWith("· back")
            ? s.activePassage!.title.replace(/\s· back$/, "")
            : `${s.activePassage!.title} · back`
          : "Back out";
        const draft: LocalDraft = {
          localId: `back-${Date.now()}`,
          title,
          region: s.activePassage?.region ?? "",
          notes: "Reversed GPS trail — same water out.",
          kind: "passage",
          waypoints,
          savedAt: new Date().toISOString(),
        };
        set({
          activePassage: draft,
          drawMode: "idle",
          followBoat: true,
          chartUp: "heading",
          panel: null,
          pinnedMark: null,
          courseMark: 0,
        });
        return true;
      },
      startDrawPack: () =>
        set({
          tapMode: "draw-pack",
          packDraft: [],
          panel: null,
          followBoat: false,
        }),
      appendPackCorner: (p) => {
        const d = get().packDraft;
        if (d.length === 0) {
          set({ packDraft: [p] });
          return;
        }
        set({ packDraft: [d[0]!, p] });
      },
      setPackDrag: (a, b) => set({ packDraft: b ? [a, b] : [a] }),
      commitPackBox: () => {
        const d = get().packDraft;
        if (d.length < 2) return false;
        const packBox = squareFromCorners(d[0]!, d[1]!);
        if (boxShortM(packBox) < 80) return false;
        set({
          packBox,
          packDraft: [],
          tapMode: "none",
          panel: "layers",
        });
        return true;
      },
      popPackCorner: () => set({ packDraft: get().packDraft.slice(0, -1) }),
      clearPackBox: () => set({ packBox: null, packDraft: [], tapMode: "none" }),
      setPackBox: (packBox) => set({ packBox }),
      setOfflinePacks: (offlinePacks) => set({ offlinePacks }),
      setPinnedMark: (pinnedMark) => set({ pinnedMark }),
      setCourseMark: (n) =>
        set({ courseMark: Math.max(0, Math.min(500, Math.round(n))) }),
      dropMob: () => {
        const boat = get().boat;
        if (!boat) return false;
        set({
          mob: { lat: boat.lat, lng: boat.lng, at: Date.now() },
          mobMuted: false,
          panel: null,
        });
        return true;
      },
      clearMob: () => set({ mob: null, mobMuted: false }),
      setMobMuted: (mobMuted) => set({ mobMuted }),
    }),
    {
      name: "reefpilot-helm-v8",
      storage: helmStorage,
      partialize: (s) => ({
        imagery: s.imagery,
        labels: s.labels,
        graticule: s.graticule,
        seamarks: s.seamarks,
        depths: s.depths,
        reefOutlines: s.reefOutlines,
        parkZones: s.parkZones,
        sunlight: s.sunlight,
        look: s.look,
        autoNight: s.autoNight,
        depthUnit: s.depthUnit,
        lengthUnit: s.lengthUnit,
        sunPunch: s.sunPunch,
        drafts: s.drafts,
        lastFix: s.lastFix,
        rode: s.rode,
        hull: s.hull,
        chartUp: s.chartUp,
        boatLow: s.boatLow,
        steerSense: s.steerSense,
        xteAlarmM: s.xteAlarmM,
        steerEar: s.steerEar,
        trackTurnDeg: s.trackTurnDeg,
        trackChordM: s.trackChordM,
        alarmSound: s.alarmSound,
        gpsAlarmOn: s.gpsAlarmOn,
        wxHorizonH: s.wxHorizonH,
        wxLayers: s.wxLayers,
        wxModels: s.wxModels,
        swingTrailOn: s.swingTrailOn,
        crumb: s.crumb,
        crumbOn: s.crumbOn,
        mob: s.mob,
        // Restored on relaunch so an OS kill overnight does not silently end the watch.
        anchor: s.anchor?.demo ? null : s.anchor,
        guideDone: s.guideDone,
        remoteWatch: s.remoteWatch,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<HelmState>;
        const last = isBoatFix(p.lastFix) ? p.lastFix : current.lastFix;
        const boat = last ? asLastKnown(last) : null;
        const rode = clampRode({ ...current.rode, ...(p.rode ?? {}) });
        const hull = clampBoat({
          ...current.hull,
          ...(p.hull ?? {}),
          loaM: p.hull?.loaM ?? rode.loaM,
          bowM: p.hull?.bowM ?? rode.bowM,
        });
        return {
          ...current,
          ...p,
          imagery: isImageryId(p.imagery) ? usableImagery(p.imagery) : current.imagery,
          depths: typeof p.depths === "boolean" ? p.depths : current.depths,
          reefOutlines:
            typeof p.reefOutlines === "boolean" ? p.reefOutlines : current.reefOutlines,
          parkZones: typeof p.parkZones === "boolean" ? p.parkZones : current.parkZones,
          autoNight: typeof p.autoNight === "boolean" ? p.autoNight : current.autoNight,
          depthUnit: applyDepthUnit(p.depthUnit, current.depthUnit),
          guideDone: typeof p.guideDone === "boolean" ? p.guideDone : current.guideDone,
          remoteWatch:
            p.remoteWatch &&
            isTopic(p.remoteWatch.topic) &&
            typeof p.remoteWatch.boatName === "string"
              ? { topic: p.remoteWatch.topic, boatName: p.remoteWatch.boatName.slice(0, 40) }
              : null,
          lengthUnit: applyLengthUnit(p.lengthUnit, current.lengthUnit),
          look: isLookMode(p.look)
            ? p.look
            : p.sunlight === true
              ? "sunlight"
              : current.look,
          sunlight:
            isLookMode(p.look)
              ? p.look === "sunlight"
              : typeof p.sunlight === "boolean"
                ? p.sunlight
                : current.sunlight,
          sunPunch:
            p.sunPunch === 1 || p.sunPunch === 2 || p.sunPunch === 3
              ? p.sunPunch
              : current.sunPunch,
          rode: clampRode({ ...rode, loaM: hull.loaM, bowM: hull.bowM }),
          hull,
          chartUp: isChartUp(p.chartUp) ? p.chartUp : current.chartUp,
          boatLow: typeof p.boatLow === "boolean" ? p.boatLow : current.boatLow,
          steerSense: isSteerSense(p.steerSense) ? p.steerSense : current.steerSense,
          xteAlarmM:
            typeof p.xteAlarmM === "number" && Number.isFinite(p.xteAlarmM)
              ? p.xteAlarmM === 25 || p.xteAlarmM === 2
                ? 1
                : Math.max(0, Math.min(200, Math.round(p.xteAlarmM)))
              : 1,
          steerEar: typeof p.steerEar === "boolean" ? p.steerEar : true,
          trackTurnDeg:
            typeof p.trackTurnDeg === "number" && Number.isFinite(p.trackTurnDeg)
              ? Math.max(5, Math.min(90, Math.round(p.trackTurnDeg)))
              : 30,
          trackChordM:
            typeof p.trackChordM === "number" && Number.isFinite(p.trackChordM)
              ? Math.max(1, Math.min(80, Math.round(p.trackChordM)))
              : 8,
          wxHorizonH:
            typeof p.wxHorizonH === "number"
              ? clampWxHorizon(p.wxHorizonH)
              : current.wxHorizonH,
          wxLayers: readWxLayers(p.wxLayers, current.wxLayers),
          wxModels: readWxModels(p.wxModels, current.wxModels),
          swingTrailOn:
            typeof p.swingTrailOn === "boolean" ? p.swingTrailOn : current.swingTrailOn,
          crumbOn: typeof p.crumbOn === "boolean" ? p.crumbOn : current.crumbOn,
          crumb: Array.isArray(p.crumb)
            ? p.crumb.filter(
                (pt): pt is LatLng =>
                  Boolean(pt) &&
                  typeof pt === "object" &&
                  Number.isFinite((pt as LatLng).lat) &&
                  Number.isFinite((pt as LatLng).lng),
              )
            : current.crumb,
          mob: isMobMark(p.mob) ? p.mob : null,
          anchor: isAnchorWatch(p.anchor) ? p.anchor : null,
          alarmSound: isAlarmSound(p.alarmSound) ? p.alarmSound : current.alarmSound,
          gpsAlarmOn: typeof p.gpsAlarmOn === "boolean" ? p.gpsAlarmOn : true,
          introOpen: false,
          panel: null,
          tapMode: "none",
          swingTrail: [],
          followBoat: Boolean(boat),
          lastFix: last,
          boat,
          flyTo: boat
            ? { lat: boat.lat, lng: boat.lng, zoom: HELM_ZOOM, nonce: 1 }
            : reefOpen(typeof p.reefId === "string" ? p.reefId : current.reefId),
          chartZoom: boat ? HELM_ZOOM : reefOpen(typeof p.reefId === "string" ? p.reefId : current.reefId).zoom,
        };
      },
    },
  ),
);

export function isLocalDraft(p: Passage | LocalDraft): p is LocalDraft {
  return "localId" in p;
}

export function passagePoints(
  p: Passage | LocalDraft | { waypoints: Waypoint[] },
): LatLng[] {
  return p.waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));
}

const guideCache = new WeakMap<
  Waypoint[],
  { turn: number | undefined; chord: number | undefined; pts: LatLng[] }
>();

/**
 * The saved line only. The live crumb must not add points while you are following it.
 * Memoised per waypoint array: the map, the anchor watch and the mark tracker all ask
 * for this every second, and simplifying a long passage each time was wasted work.
 * Callers must treat the result as read-only.
 */
export function guidePoints(
  p: Passage | LocalDraft | { waypoints: Waypoint[] },
  _crumb?: LatLng[],
  clean?: Partial<TrackClean>,
): LatLng[] {
  const hit = guideCache.get(p.waypoints);
  if (hit && hit.turn === clean?.turnDeg && hit.chord === clean?.chordM) return hit.pts;
  const pts = simplifyTrack(p.waypoints, clean);
  guideCache.set(p.waypoints, { turn: clean?.turnDeg, chord: clean?.chordM, pts });
  return pts;
}

export function helmBow(s: { boat: BoatFix | null; hull: BoatSetup }): LatLng | null {
  return bowOf(s.boat, s.hull);
}

/** Re-render on a units change (the formatters read module state, not React state). */
export function useUnitsKey(): string {
  return useHelm((s) => `${s.depthUnit}|${s.lengthUnit}`);
}
