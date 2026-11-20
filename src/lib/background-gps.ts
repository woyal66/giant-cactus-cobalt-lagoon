/**
 * Phone-only GPS that keeps running with the screen locked.
 *
 * The plain Geolocation plugin and browser timers stop when the phone sleeps,
 * which silently disables the anchor watch. While a watch is armed the app uses
 * this watcher instead:
 *   - Android runs it as a foreground service with a persistent notification.
 *   - iOS keeps receiving fixes through the "location" background mode
 *     (UIBackgroundModes in Info.plist), shown as the blue status-bar pill.
 *
 * Every fix also fires a `helm:fix` window event so the anchor watch evaluates
 * immediately instead of waiting on a timer the OS may have frozen.
 */
import { registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin, Location } from "@capacitor-community/background-geolocation";

export const FIX_EVENT = "helm:fix";

let plugin: BackgroundGeolocationPlugin | null = null;
function bg(): BackgroundGeolocationPlugin {
  plugin ??= registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
  return plugin;
}

export function asPosition(loc: Location): GeolocationPosition {
  return {
    coords: {
      latitude: loc.latitude,
      longitude: loc.longitude,
      accuracy: loc.accuracy,
      altitude: loc.altitude,
      altitudeAccuracy: loc.altitudeAccuracy,
      heading: loc.bearing,
      speed: loc.speed,
      toJSON() {
        return this;
      },
    },
    timestamp: loc.time ?? Date.now(),
    toJSON() {
      return this;
    },
  };
}

export type BackgroundWatch = { stop: () => void };

/**
 * Start a lock-screen-safe watcher. `onDenied` fires when the user refuses
 * location access. Returns a handle whose `stop()` is safe to call at any time,
 * including before the native watcher has finished starting.
 */
export function startBackgroundGps(
  onFix: (pos: GeolocationPosition) => void,
  onDenied: () => void,
): BackgroundWatch {
  let id: string | null = null;
  let stopped = false;

  void bg()
    .addWatcher(
      {
        backgroundTitle: "Anchor Mate is on watch",
        backgroundMessage: "Tracking your position so the anchor alarm can sound.",
        requestPermissions: true,
        stale: false,
        distanceFilter: 0,
      },
      (loc, err) => {
        if (stopped) return;
        if (err) {
          if (err.code === "NOT_AUTHORIZED") onDenied();
          return;
        }
        if (!loc) return;
        onFix(asPosition(loc));
        window.dispatchEvent(new Event(FIX_EVENT));
      },
    )
    .then((watcherId) => {
      id = watcherId;
      if (stopped) void bg().removeWatcher({ id: watcherId });
    })
    .catch(() => onDenied());

  return {
    stop() {
      stopped = true;
      if (id) void bg().removeWatcher({ id });
      id = null;
    },
  };
}

/** Opens the OS settings page for this app (used after location was refused). */
export function openLocationSettings(): void {
  void bg().openSettings();
}
