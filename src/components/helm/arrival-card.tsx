import { useQuery } from "@tanstack/react-query";
import { fetchWeather, windCardinal, type WxHour } from "@/lib/weather";
import { moonInfo } from "@/lib/moon";
import { sunRiseSet } from "@/lib/sun";
import { formatDepth } from "@/lib/units";
import type { LatLng } from "@/lib/geo";

const H = 3_600_000;

function clock(at: number): string {
  const d = new Date(at);
  return `${d.toLocaleDateString([], { weekday: "short" })} ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function nearest(hours: WxHour[], at: number): WxHour | null {
  let best: WxHour | null = null;
  for (const h of hours) if (!best || Math.abs(h.at - at) < Math.abs(best.at - at)) best = h;
  return best;
}

/** 16-point compass index for a direction. */
function sector(dir: number) {
  return Math.round((((dir % 360) + 360) % 360) / 22.5) % 16;
}

/**
 * Destination forecast: conditions at the ETA, the night after (will the anchorage
 * hold up?), tide, light and moon, and which wind directions the coastline
 * shelters you from.
 */
export function ArrivalCard({ finish, eta, shelter }: { finish: LatLng; eta: number; shelter?: boolean[] }) {
  const wx = useQuery({
    queryKey: ["arrival-wx", finish.lat.toFixed(2), finish.lng.toFixed(2)],
    queryFn: () => fetchWeather(finish.lat, finish.lng),
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const sun = sunRiseSet(finish.lat, finish.lng, eta);
  const moon = moonInfo(finish.lat, finish.lng, eta);
  const data = wx.data;
  const at = data ? nearest(data.hours, eta) : null;
  // The night after arrival: ETA to 07:00 next morning (at least 10 h).
  const night = data ? data.hours.filter((h) => h.at >= eta && h.at <= eta + 14 * H) : [];
  const worst = night.reduce<WxHour | null>((m, h) => (!m || (h.gustKn ?? h.windKn) > (m.gustKn ?? m.windKn) ? h : m), null);
  const exposedHours = shelter ? night.filter((h) => !shelter[sector(h.dirDeg)] && h.windKn >= 12) : [];
  const turns = data?.sea?.tideTurns?.filter((t) => t.at >= eta - H).slice(0, 2) ?? [];
  const sunsetGap = sun ? (sun.set - eta) / 60_000 : null;

  return (
    <div className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-[12px] leading-snug">
      <p className="mb-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Arrival</p>
      {wx.isLoading ? <p className="text-muted-foreground">Loading the destination forecast…</p> : null}
      {wx.isError && !data ? <p className="text-muted-foreground">No destination forecast: no signal.</p> : null}
      {at ? (
        <p>
          At {clock(eta)}: <b>{Math.round(at.windKn)} kn {windCardinal(at.dirDeg)}</b>
          {at.gustKn ? `, gusts ${Math.round(at.gustKn)}` : ""}
          {at.precipMm >= 0.5 ? `, rain ${at.precipMm.toFixed(1)} mm/h` : ""}
          {data?.sea?.waveM != null ? ` · seas around ${formatDepth(data.sea.waveM)}` : ""}
        </p>
      ) : null}
      {worst ? (
        <p className="mt-0.5">
          Overnight: up to <b>{Math.round(worst.gustKn ?? worst.windKn)} kn {windCardinal(worst.dirDeg)}</b> around{" "}
          {new Date(worst.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          {at && Math.abs(((worst.dirDeg - at.dirDeg + 540) % 360) - 180) >= 60 ? ", a wind shift: re-check your swing room" : ""}.
        </p>
      ) : null}
      {shelter ? (
        <p className={`mt-0.5 ${exposedHours.length ? "text-amber-300" : "text-muted-foreground"}`}>
          {exposedHours.length
            ? `Exposed to ${windCardinal(exposedHours[0]!.dirDeg)} wind for about ${exposedHours.length} h overnight. Consider the other side of the island or point.`
            : "The coastline shelters this spot from the overnight wind (coarse coastline: check the chart)."}
        </p>
      ) : null}
      <p className="mt-0.5 text-muted-foreground">
        {sun
          ? sunsetGap != null && sunsetGap > 0
            ? `Sunset ${new Date(sun.set).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}: arrive ${Math.round(sunsetGap / 60)} h ${Math.round(sunsetGap % 60)} m before it.`
            : `Arrives after sunset (${new Date(sun.set).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}).`
          : ""}{" "}
        Moon {Math.round(moon.illumination * 100)}% lit{moon.nextRise ? `, rises ${new Date(moon.nextRise).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}.
      </p>
      {turns.length ? (
        <p className="mt-0.5 text-muted-foreground">
          Tide: {turns.map((t) => `${t.kind === "high" ? "HW" : "LW"} ${new Date(t.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`).join(" · ")}
        </p>
      ) : null}
      <p className="mt-1 text-[11px] text-muted-foreground">When you're on the hook, tap Anchor to start the watch.</p>
    </div>
  );
}
