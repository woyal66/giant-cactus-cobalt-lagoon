import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWx } from "@/hooks/weather";
import { bearingDegrees, formatHeading, formatLat, formatLng, formatMeters, haversineMeters } from "@/lib/geo";
import { seabedAt, waterDepthM } from "@/lib/depth";
import { formatDepth } from "@/lib/units";
import { formatKn, windCardinal } from "@/lib/weather";
import { useHelm, useUnitsKey, type LocalDraft } from "@/store/helm";

/**
 * Press and hold the chart: one card for that spot, with the useful actions. The wind shown
 * is the forecast near the boat (the full forecast for the spot is one tap away).
 */
export function PinCard() {
  useUnitsKey();
  const pin = useHelm((s) => s.wxPin);
  const card = useHelm((s) => s.pinCard);
  const boat = useHelm((s) => s.boat);
  const tide = useHelm((s) => s.tideNowMsl);
  const panel = useHelm((s) => s.panel);
  const wx = useWx();
  const [seabed, setSeabed] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    if (!pin || !card) return;
    let live = true;
    setSeabed(undefined);
    void seabedAt(pin.lat, pin.lng).then((h) => {
      if (live) setSeabed(h);
    });
    return () => {
      live = false;
    };
  }, [pin, card]);

  if (!pin || !card || panel) return null;
  const s = useHelm.getState();
  const close = () => useHelm.setState({ pinCard: false, wxPin: null });
  const dist = boat ? haversineMeters(boat, pin) : null;
  const brg = boat ? formatHeading(bearingDegrees(boat, pin)) : null;
  const depth = seabed == null ? null : waterDepthM(seabed, tide ?? 0);
  const now = wx.data?.now;

  return (
    <div className="pointer-events-auto absolute inset-x-2 bottom-[calc(max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))+5.2rem)] z-40 mx-auto max-w-md rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-t16 font-semibold tabular-nums">
            {dist != null ? `${formatMeters(dist)} · ${brg}` : "This spot"}
          </p>
          <p className="text-t13 text-muted-foreground tabular-nums">
            {formatLat(pin.lat)} {formatLng(pin.lng)}
          </p>
        </div>
        <Button variant="outline" className="h-10 px-3" onClick={close}>
          Close
        </Button>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 text-t14 leading-snug tabular-nums">
        <p>
          <span className="text-muted-foreground">Depth </span>
          {seabed === undefined
            ? "…"
            : depth == null
              ? "unknown"
              : depth <= 0
                ? "land or drying"
                : `about ${formatDepth(depth)}`}
        </p>
        <p>
          <span className="text-muted-foreground">Wind </span>
          {now ? `${formatKn(now.windKn)} kn ${windCardinal(now.dirDeg)}` : "—"}
        </p>
      </div>
      <p className="text-t12 text-muted-foreground">Depth is approximate (model, at today's tide): check the sounder.</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Button
          className="h-11"
          disabled={!boat}
          onClick={() => {
            if (!boat) return;
            const d: LocalDraft = {
              localId: `goto-${Date.now()}`,
              title: "Go to",
              region: "",
              notes: "Straight line from the boat to a chosen spot.",
              kind: "passage",
              tapped: true,
              waypoints: [
                { lat: boat.lat, lng: boat.lng, label: "Start" },
                { lat: pin.lat, lng: pin.lng, label: "Go to" },
              ],
              savedAt: new Date().toISOString(),
            };
            s.setActivePassage(d);
            s.setChartUp("heading");
            s.setBoatLow(true);
            close();
          }}
        >
          Go to
        </Button>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => {
            if (s.drawMode !== "draw") s.setDrawMode("draw");
            s.appendDraft({ lat: pin.lat, lng: pin.lng, label: `WP ${useHelm.getState().draft.length + 1}` });
            close();
          }}
        >
          Add to route
        </Button>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => {
            useHelm.setState({ pinCard: false });
            s.setPanel("weather");
          }}
        >
          Forecast here
        </Button>
        <Button
          variant="outline"
          className="h-11"
          onClick={() => {
            useHelm.setState({ pinCard: false, wxPin: null, measurePts: [{ lat: pin.lat, lng: pin.lng }] });
            s.setPanel(null);
            s.setTapMode("measure");
          }}
        >
          Measure from here
        </Button>
      </div>
    </div>
  );
}
