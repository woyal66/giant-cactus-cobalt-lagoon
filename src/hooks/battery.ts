import { useEffect } from "react";
import { useHelm } from "@/store/helm";

type BatteryLike = { level: number; charging: boolean; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void };

/** Below this, off charge, the app saves power where it can without touching the watch. */
export const LOW_BATTERY = 0.2;

/**
 * Battery saver: when the phone is low and not charging, the weather map shows still arrows
 * instead of moving particles. The anchor watch, GPS and alarms are never changed. Where the
 * browser can't read the battery (iPhone), nothing changes.
 */
export function useBatterySaver() {
  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryLike> };
    if (!nav.getBattery) return;
    let bat: BatteryLike | null = null;
    const read = () => {
      if (!bat) return;
      const low = !bat.charging && bat.level <= LOW_BATTERY;
      if (useHelm.getState().lowBattery !== low) useHelm.setState({ lowBattery: low });
    };
    void nav.getBattery().then((b) => {
      bat = b;
      read();
      b.addEventListener("levelchange", read);
      b.addEventListener("chargingchange", read);
    }).catch(() => undefined);
    return () => {
      bat?.removeEventListener("levelchange", read);
      bat?.removeEventListener("chargingchange", read);
    };
  }, []);
}
