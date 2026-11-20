/** Anchor / track watch.
 *  A sleeping page with no fresh fix must not alarm.
 *  A fresh fix that arrives while the screen is off can still start a drag.
 */

export const GPS_LOST_MS = 60_000;
export const WAKE_GRACE_MS = 20_000;
export const HOLD_MS = 12_000;
export const GOOD_ACC_M = 80;

export type GuardState = {
  lastGoodAt: number | null;
  visible: boolean;
  becameVisibleAt: number | null;
  dragSince: number | null;
  xteSince: number | null;
};

export type GuardInput = {
  now: number;
  visible: boolean;
  goodFix: boolean;
  fixAt?: number;
  dragging: boolean;
  offTrack: boolean;
  armed: boolean;
};

export type GuardAlarms = {
  drag: boolean;
  xte: boolean;
  gpsLost: boolean;
};

export function freshGuard(now: number, visible: boolean): GuardState {
  return {
    lastGoodAt: null,
    visible,
    becameVisibleAt: visible ? now : null,
    dragSince: null,
    xteSince: null,
  };
}

export function isGoodFix(
  accuracyM: number | null | undefined,
  source?: string,
): boolean {
  if (source === "demo") return true;
  if (source === "placed") return false;
  if (accuracyM == null || !Number.isFinite(accuracyM)) return true;
  return accuracyM <= GOOD_ACC_M;
}

function held(since: number | null, now: number): boolean {
  return since != null && now - since >= HOLD_MS;
}

export function stepGuard(s: GuardState, e: GuardInput): { state: GuardState; alarms: GuardAlarms } {
  let lastGoodAt = s.lastGoodAt;
  let becameVisibleAt = s.becameVisibleAt;
  let dragSince = s.dragSince;
  let xteSince = s.xteSince;

  if (e.visible && !s.visible) becameVisibleAt = e.now;
  if (!e.visible) becameVisibleAt = s.becameVisibleAt;

  if (e.goodFix) lastGoodAt = e.fixAt ?? e.now;
  else if (e.armed && e.visible && lastGoodAt == null) lastGoodAt = e.now;

  if (!e.visible) {
    /* Hidden: never GPS-lost. A frozen page has no fixes and must not nuisance-alarm.
       A fresh fix still arriving (screen off, app in the background) can start a drag.
       A stale fix must not let an old clock mature. */
    if (!e.armed) {
      return {
        state: {
          lastGoodAt: null,
          visible: false,
          becameVisibleAt,
          dragSince: null,
          xteSince: null,
        },
        alarms: { drag: false, xte: false, gpsLost: false },
      };
    }
    if (e.goodFix) {
      dragSince = e.dragging ? (dragSince ?? e.now) : null;
      xteSince = e.offTrack ? (xteSince ?? e.now) : null;
      return {
        state: {
          lastGoodAt,
          visible: false,
          becameVisibleAt,
          dragSince,
          xteSince,
        },
        alarms: {
          drag: held(dragSince, e.now),
          xte: held(xteSince, e.now),
          gpsLost: false,
        },
      };
    }
    return {
      state: {
        lastGoodAt,
        visible: false,
        becameVisibleAt,
        dragSince,
        xteSince,
      },
      alarms: { drag: false, xte: false, gpsLost: false },
    };
  }

  if (!e.armed) {
    return {
      state: {
        lastGoodAt: null,
        visible: true,
        becameVisibleAt,
        dragSince: null,
        xteSince: null,
      },
      alarms: { drag: false, xte: false, gpsLost: false },
    };
  }

  if (e.goodFix) {
    dragSince = e.dragging ? (dragSince ?? e.now) : null;
    xteSince = e.offTrack ? (xteSince ?? e.now) : null;
  }

  const waking =
    becameVisibleAt != null && e.now - becameVisibleAt < WAKE_GRACE_MS;
  const gpsLost =
    !waking && lastGoodAt != null && e.now - lastGoodAt >= GPS_LOST_MS;

  return {
    state: {
      lastGoodAt,
      visible: true,
      becameVisibleAt,
      dragSince,
      xteSince,
    },
    alarms: {
      drag: held(dragSince, e.now),
      xte: held(xteSince, e.now),
      gpsLost,
    },
  };
}
