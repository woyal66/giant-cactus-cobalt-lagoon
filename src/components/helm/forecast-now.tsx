import { formatKn, stormRiskOf, windCardinal, type WxForecast } from "@/lib/weather";
import { RISK_LABEL } from "@/lib/routing/storm";
import { formatDepth } from "@/lib/units";

const H = 3_600_000;

function clock(at: number): string {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? "" : `${d.toLocaleDateString([], { weekday: "short" })} `}${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

/** The answer to "what's it doing now, and what's coming in the next day?" at a glance. */
export function ForecastNow({ data }: { data: WxForecast }) {
  const now = data.now;
  const t = Date.now();
  const next24 = data.hours.filter((h) => h.at >= t - H && h.at <= t + 24 * H);
  const peak = next24.reduce((a, h) => ((h.gustKn ?? h.windKn) > (a.gustKn ?? a.windKn) ? h : a), next24[0] ?? now);
  const rain = next24.reduce((a, h) => a + h.precipMm, 0);
  const storm = next24.reduce((a, h) => Math.max(a, stormRiskOf(h)), 0);
  const sea = data.sea;
  const turns = (sea?.tideTurns ?? []).filter((x) => x.at > t).slice(0, 2);
  const tideNow = sea?.tideHours?.length ? sea.tideHours : null;
  const rising =
    tideNow && tideNow.length >= 2
      ? (() => {
          const i = tideNow.findIndex((h) => h.at > t);
          return i > 0 ? tideNow[i]!.m > tideNow[i - 1]!.m : null;
        })()
      : null;
  const gustNow = now.gustKn ?? now.windKn;
  const strong = (peak.gustKn ?? peak.windKn) >= 25 || peak.windKn >= 22;

  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-t13 text-muted-foreground">Wind now</p>
          <p className="font-display text-3xl leading-none font-semibold tabular-nums">
            {formatKn(now.windKn)}
            <span className="ml-1 text-lg font-medium">kn {windCardinal(now.dirDeg)}</span>
          </p>
          <p className={`text-t14 tabular-nums ${gustNow >= 25 ? "text-destructive" : "text-muted-foreground"}`}>
            Gusts {formatKn(gustNow)} kn
          </p>
          <p className="text-t14 text-muted-foreground tabular-nums">{Math.round(now.tempC)}°C</p>
        </div>
        <div className="text-right text-t14 leading-snug tabular-nums">
          {sea?.waveM != null ? (
            <p>
              Sea <b>{formatDepth(sea.waveM)}</b>
              {sea.periodS ? ` · ${Math.round(sea.periodS)} s` : ""}
            </p>
          ) : null}
          {sea?.swellM != null ? <p className="text-muted-foreground">Swell {formatDepth(sea.swellM)}</p> : null}
          {rising != null ? <p>Tide {rising ? "rising" : "falling"}</p> : null}
          {turns.map((x) => (
            <p key={x.at} className="whitespace-nowrap text-muted-foreground">
              {x.kind === "high" ? "High" : "Low"} {clock(x.at)}
            </p>
          ))}
        </div>
      </div>
      <p
        className={`mt-2 rounded-md px-2 py-1 text-t14 leading-snug ${strong ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}
      >
        Next 24 h: strongest {formatKn(peak.windKn)} kn {windCardinal(peak.dirDeg)}
        {peak.gustKn != null ? ` (gusts ${formatKn(peak.gustKn)})` : ""} at {clock(peak.at)}
        {rain >= 0.5 ? ` · rain ${rain.toFixed(rain < 10 ? 1 : 0)} mm` : " · dry"}
        {storm > 0 ? ` · storms ${RISK_LABEL[storm as 1 | 2 | 3].toLowerCase()}` : ""}
      </p>
    </div>
  );
}
