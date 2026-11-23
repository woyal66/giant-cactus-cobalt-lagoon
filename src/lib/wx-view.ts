import { useSyncExternalStore } from "react";
import type { WeatherField } from "./routing/field.ts";

/** The weather grid the chart is showing, shared with the tap-anywhere readout. */
let current: WeatherField | null = null;
const subs = new Set<() => void>();

export function setViewField(f: WeatherField | null) {
  if (f === current) return;
  current = f;
  for (const s of subs) s();
}

export function getViewField(): WeatherField | null {
  return current;
}

export function useViewField(): WeatherField | null {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => current,
  );
}
