import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { useWx } from "@/hooks/weather";
import { formatMeters } from "@/lib/geo";
import { useHelm, useUnitsKey } from "@/store/helm";

/**
 * GPS quality from the fix: good under 10 m, fair to 30 m, poor beyond; stale after 90 s. At
 * anchor the phone takes a fix only every 30 s well inside the circle, so a shorter limit would
 * cry wolf all night.
 */
function gpsQuality(source: string | undefined, accuracyM: number | null | undefined, ageMs: number) {
  if (!source || source === "none") return "none" as const;
  if (source === "placed" || source === "last") return "manual" as const;
  if (ageMs > 90_000) return "stale" as const;
  if (accuracyM == null || !Number.isFinite(accuracyM)) return "good" as const;
  return accuracyM <= 10 ? ("good" as const) : accuracyM <= 30 ? ("fair" as const) : ("poor" as const);
}

function ago(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

/**
 * The few facts that matter when the app is your alarm, always in view: GPS quality, whether
 * there is signal, and how old the forecast is. Tap for what each means.
 */
export function StatusChips() {
  useUnitsKey();
  const boat = useHelm((s) => s.boat);
  const lowBattery = useHelm((s) => s.lowBattery);
  const wx = useWx();
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const t = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.clearInterval(t);
    };
  }, []);

  const q = gpsQuality(boat?.source, boat?.accuracy, boat ? now - boat.at : Infinity);
  const gpsText =
    q === "none" ? "No GPS" : q === "manual" ? "Placed" : q === "stale" ? "GPS old" : boat?.accuracy != null ? `±${formatMeters(boat.accuracy)}` : "GPS";
  const gpsTone = q === "good" ? "ok" : q === "fair" || q === "manual" ? "warn" : "bad";
  const saved = (wx.data as { savedAt?: number } | undefined)?.savedAt;
  const wxAt = saved ?? (wx.dataUpdatedAt || 0);
  const wxAge = wxAt ? now - wxAt : null;

  const tone = (t: string) =>
    t === "ok" ? "border-primary/60 text-foreground" : t === "warn" ? "border-amber-400/70 text-amber-200" : "border-destructive bg-destructive text-white";

  return (
    <div className="relative flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Status. GPS ${gpsText}. ${online ? "Online" : "No signal"}.${wxAge != null ? ` Forecast ${ago(wxAge)} old.` : ""} Tap for details`}
        className="rp-glass flex flex-col items-stretch gap-0.5 rounded-md border border-border bg-card/95 p-1 shadow-[var(--shadow-border)]"
      >
        <span className={`rounded border px-1.5 py-0.5 text-center text-t11 font-semibold tabular-nums ${tone(gpsTone)}`}>{gpsText}</span>
        {lowBattery ? (
          <span className={`rounded border px-1.5 py-0.5 text-center text-t11 font-semibold ${tone("warn")}`}>Battery low</span>
        ) : null}
        {!online ? (
          <span className={`flex items-center justify-center gap-1 rounded border px-1.5 py-0.5 text-t11 font-semibold ${tone("warn")}`}>
            <WifiOff className="size-3" aria-hidden />
            Offline
          </span>
        ) : null}
        {wxAge != null && wxAge > 3 * 3_600_000 ? (
          <span className={`rounded border px-1.5 py-0.5 text-center text-t11 font-semibold ${tone(wxAge > 24 * 3_600_000 ? "bad" : "warn")}`}>Wx {ago(wxAge)}</span>
        ) : null}
      </button>
      {open ? (
        <div className="rp-glass absolute top-full right-0 z-40 mt-1 w-64 rounded-lg border border-border bg-card p-2.5 text-t13 leading-snug shadow-[var(--shadow-border)]">
          <p className="font-semibold">
            GPS:{" "}
            {q === "good"
              ? "good"
              : q === "fair"
                ? "fair"
                : q === "poor"
                  ? "poor"
                  : q === "stale"
                    ? "no new fix for a while"
                    : q === "manual"
                      ? "boat placed by hand"
                      : "no fix"}
            {boat?.accuracy != null && q !== "manual" ? ` (±${formatMeters(boat.accuracy)})` : ""}
          </p>
          <p className="text-muted-foreground">
            {q === "good"
              ? "Precise enough for the anchor alarm and steering."
              : q === "fair"
                ? "Fine for passage making; the anchor alarm ignores fixes too vague for its circle."
                : "Go on deck or near a window, and check location is allowed for Anchor Mate."}
          </p>
          <p className="mt-1.5 font-semibold">{online ? "Signal: online" : "Signal: none"}</p>
          <p className="text-muted-foreground">
            {online ? "Maps, forecasts and tides update." : "Saved maps, tides and the last forecast are used. The anchor alarm works without signal."}
          </p>
          {lowBattery ? (
            <>
              <p className="mt-1.5 font-semibold">Battery low, not charging</p>
              <p className="text-muted-foreground">Saving power: the weather map shows still arrows. The anchor watch and alarms are unchanged. Plug in if you can.</p>
            </>
          ) : null}
          <p className="mt-1.5 font-semibold">Forecast: {wxAge != null ? `${ago(wxAge)} old` : "not loaded"}</p>
          <p className="text-muted-foreground">Updates when there is signal. Older than a day, treat it with care.</p>
        </div>
      ) : null}
    </div>
  );
}
