import { useEffect } from "react";
import { toast } from "sonner";
import { isNativeApp } from "@/lib/native";
import {
  aisStreamSubscribe,
  dangers,
  dangerText,
  mergeTarget,
  parseAisStream,
  parseSignalK,
  pruneTargets,
  signalKUrl,
  type AisTarget,
  type Own,
} from "@/lib/ais";
import { useHelm } from "@/store/helm";

const AISSTREAM = "wss://stream.aisstream.io/v0/stream";
const PUBLISH_MS = 2000;
const BOX_DEG = 0.75;
const ALERT_AGAIN_MS = 10 * 60_000;
const AIS_NOTICE_ID = 820;

/**
 * AIS targets on the chart, and the close-approach alarm. Connects only while a source is set in
 * Settings. Online needs signal; Signal K needs the phone on the boat's Wi-Fi. Both pause when
 * the app is in the background on iPhone.
 */
export function useAis() {
  const source = useHelm((s) => s.aisSource);
  const key = useHelm((s) => s.aisKey);
  const host = useHelm((s) => s.aisHost);

  useEffect(() => {
    const status = (state: "off" | "connecting" | "live" | "error", note: string | null = null) =>
      useHelm.setState({ aisStatus: { state, note, at: Date.now() } });
    if (source === "off") {
      useHelm.setState({ aisTargets: [], aisCard: null });
      status("off");
      return;
    }
    const url = source === "online" ? AISSTREAM : signalKUrl(host);
    if (!url || (source === "online" && key.trim().length < 20)) {
      status("error", source === "online" ? "Add your aisstream.io key in Settings." : "Type the Signal K server's address in Settings.");
      return;
    }
    const targets = new Map<string, AisTarget>();
    const alerted = new Map<string, number>();
    let ws: WebSocket | null = null;
    let self: string | undefined;
    let box: { s: number; w: number; n: number; e: number } | null = null;
    let retry = 0;
    let retryTimer = 0;
    let closed = false;

    const centre = () => {
      const s = useHelm.getState();
      return s.boat ?? (s.flyTo ? { lat: s.flyTo.lat, lng: s.flyTo.lng } : null);
    };

    const connect = () => {
      if (closed) return;
      const c = centre();
      if (source === "online" && !c) {
        status("error", "Waiting for the boat's position.");
        retryTimer = window.setTimeout(connect, 15_000);
        return;
      }
      status("connecting");
      try {
        ws = new WebSocket(url);
      } catch {
        status("error", "Couldn't open the connection.");
        return;
      }
      ws.onopen = () => {
        retry = 0;
        if (source === "online" && c) {
          box = { s: c.lat - BOX_DEG, w: c.lng - BOX_DEG, n: c.lat + BOX_DEG, e: c.lng + BOX_DEG };
          ws?.send(aisStreamSubscribe(key.trim(), box));
        }
        status("live", source === "online" ? "Online AIS (shore stations): little coverage offshore." : "Boat AIS via Signal K.");
      };
      ws.onmessage = (ev) => {
        let j: unknown;
        try {
          j = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        } catch {
          return;
        }
        if (source === "online") {
          const err = (j as { error?: string }).error;
          if (err) {
            status("error", `aisstream: ${err}`);
            return;
          }
          const u = parseAisStream(j);
          if (u) mergeTarget(targets, u);
        } else {
          const hello = j as { self?: string };
          if (typeof hello.self === "string") self = hello.self;
          for (const u of parseSignalK(j, self)) mergeTarget(targets, u);
        }
      };
      ws.onclose = () => {
        if (closed) return;
        status("error", source === "online" ? "AIS disconnected: retrying (needs signal)." : "Can't reach the Signal K server: on the boat's Wi-Fi?");
        retry = Math.min(retry + 1, 6);
        retryTimer = window.setTimeout(connect, 2000 * 2 ** retry);
      };
      ws.onerror = () => ws?.close();
    };
    connect();

    const publish = window.setInterval(() => {
      pruneTargets(targets);
      const s = useHelm.getState();
      const list = [...targets.values()].filter((t) => Number.isFinite(t.lat));
      useHelm.setState({ aisTargets: list });
      // Online: follow the boat; resubscribe when it leaves the middle of the box.
      const c = centre();
      if (source === "online" && box && c && ws?.readyState === WebSocket.OPEN) {
        const mid = { lat: (box.s + box.n) / 2, lng: (box.w + box.e) / 2 };
        if (Math.abs(c.lat - mid.lat) > BOX_DEG / 2 || Math.abs(c.lng - mid.lng) > BOX_DEG / 2) {
          box = { s: c.lat - BOX_DEG, w: c.lng - BOX_DEG, n: c.lat + BOX_DEG, e: c.lng + BOX_DEG };
          ws.send(aisStreamSubscribe(key.trim(), box));
        }
      }
      // Close-approach alarm.
      if (!s.aisAlarm.on || !s.boat || s.boat.source === "none") return;
      const own: Own = { lat: s.boat.lat, lng: s.boat.lng, sogKn: s.boat.speedMs * 1.943844, cogDeg: s.boat.heading ?? NaN };
      const now = Date.now();
      for (const d of dangers(own, list, s.aisAlarm, now)) {
        if (now - (alerted.get(d.target.mmsi) ?? 0) < ALERT_AGAIN_MS) continue;
        alerted.set(d.target.mmsi, now);
        const text = dangerText(d);
        toast.warning(`Close approach. ${text}.`, {
          duration: 20_000,
          action: { label: "Show", onClick: () => useHelm.setState({ aisCard: d.target.mmsi }) },
        });
        if (isNativeApp()) {
          void import("@capacitor/local-notifications").then(({ LocalNotifications }) =>
            LocalNotifications.schedule({ notifications: [{ id: AIS_NOTICE_ID, title: "AIS: close approach", body: text }] }).catch(() => undefined),
          );
        }
        if ("vibrate" in navigator) navigator.vibrate?.([300, 150, 300]);
      }
    }, PUBLISH_MS);

    return () => {
      closed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(publish);
      ws?.close();
    };
  }, [source, key, host]);
}
