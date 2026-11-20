/**
 * iOS-only bridge to ios/App/App/CriticalAlertPlugin.swift.
 * Critical Alerts sound through the silent switch, Do Not Disturb and Focus once
 * Apple has granted the entitlement; before that, alarms go out Time Sensitive.
 */
import { Capacitor, registerPlugin } from "@capacitor/core";

export type CriticalStatus = { granted: boolean; critical: boolean; timeSensitive: boolean };

type CriticalAlertPlugin = {
  requestPermission(): Promise<CriticalStatus>;
  status(): Promise<CriticalStatus>;
  notify(opts: { id: number; title: string; body: string }): Promise<{ critical: boolean }>;
  cancel(opts: { ids: number[] }): Promise<void>;
};

let plugin: CriticalAlertPlugin | null = null;

/** The plugin on an iPhone build, or null everywhere else. */
export function criticalAlerts(): CriticalAlertPlugin | null {
  if (Capacitor.getPlatform() !== "ios") return null;
  plugin ??= registerPlugin<CriticalAlertPlugin>("CriticalAlert");
  return plugin;
}
