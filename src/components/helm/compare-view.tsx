import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pin, PinOff, EyeOff, Eye } from "lucide-react";
import { agreementText, columnTimes, sampleAt, spreadOf, type Agreement } from "@/lib/compare";
import { fetchWaveModels, windCardinal, windColor, WX_MODEL_LABEL, type WxForecast, type WxHour, type WaveHour } from "@/lib/weather";
import { formatDepth } from "@/lib/units";
import { useHelm, useUnitsKey } from "@/store/helm";

type View = "basic" | "rain" | "waves";
const H = 3_600_000;
const LEVEL_BG: Record<Agreement, string> = { good: "#15803d", fair: "#b45309", poor: "#b91c1c" };
const LEVEL_TEXT: Record<Agreement, string> = { good: "agree", fair: "differ", poor: "differ a lot" };

/** A small arrow pointing where the wind (or swell) is going. */
function Arrow({ fromDeg }: { fromDeg: number }) {
  return (
    <span aria-hidden className="inline-block leading-none" style={{ transform: `rotate(${(fromDeg + 180) % 360}deg)` }}>
      ↑
    </span>
  );
}

/**
 * Compare forecasts, like Windy's: one strip per model, the hours lined up under each other, and
 * on top an agreement row (green: the models agree, amber: they differ, red: they differ a lot).
 */
export function CompareView({ data, lat, lng }: { data: WxForecast; lat: number; lng: number }) {
  useUnitsKey();
  const [view, setView] = useState<View>("basic");
  const [days, setDays] = useState<3 | 7>(3);
  const hidden = useHelm((s) => s.compareHidden);
  const pinned = useHelm((s) => s.comparePinned);
  const waves = useQuery({
    queryKey: ["wave-models", lat.toFixed(2), lng.toFixed(2)],
    queryFn: () => fetchWaveModels(lat, lng),
    enabled: view === "waves",
    staleTime: 30 * 60_000,
    retry: 1,
  });

  const stepH = days === 3 ? 3 : 6;
  const cols = useMemo(() => columnTimes(Date.now(), days * 24, stepH), [days, stepH]);

  // The weather models: the main one plus the others it was compared with.
  const models = useMemo(() => {
    const all = [
      { id: data.source as string, label: WX_MODEL_LABEL[data.source] ?? data.source, resKm: data.resKm, hours: data.hours },
      ...(data.compare ?? []).map((c) => ({ id: c.source as string, label: WX_MODEL_LABEL[c.source] ?? c.source, resKm: c.resKm, hours: c.hours })),
    ];
    return all;
  }, [data]);
  const waveModels = useMemo(
    () => (waves.data ?? []).map((w) => ({ id: w.source as string, label: w.label, resKm: w.resKm, hours: w.hours })),
    [waves.data],
  );
  const list = (view === "waves" ? waveModels : models)
    .slice()
    .sort((a, b) => (a.id === pinned ? -1 : b.id === pinned ? 1 : 0));
  const shown = list.filter((m) => !hidden.includes(m.id));

  const agreement = cols.map((at) => {
    if (view === "waves") {
      const v = shown.map((m) => sampleAt(m.hours as WaveHour[], at, 3 * H)?.heightM ?? NaN);
      const s = spreadOf(v, "wave");
      return { at, level: s?.level ?? null, spread: s?.spread ?? 0 };
    }
    const v = shown.map((m) => sampleAt(m.hours as WxHour[], at)?.windKn ?? NaN);
    const s = spreadOf(v, "wind");
    return { at, level: s?.level ?? null, spread: s?.spread ?? 0 };
  });
  const summary = agreementText(agreement, (n) => (view === "waves" ? formatDepth(n) : `${Math.round(n)} kn`));

  const setHidden = (id: string) => {
    const s = useHelm.getState();
    useHelm.setState({ compareHidden: s.compareHidden.includes(id) ? s.compareHidden.filter((x) => x !== id) : [...s.compareHidden, id] });
  };
  const setPinned = (id: string) => useHelm.setState({ comparePinned: pinned === id ? null : id });

  const dayStarts = new Set(cols.filter((t, i) => i === 0 || new Date(t).getDate() !== new Date(cols[i - 1]!).getDate()));
  const colW = "w-11 min-w-11";
  const label = "sticky left-0 z-10 w-24 min-w-24 bg-card pr-1.5 text-left align-middle";

  return (
    <div className="mt-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex rounded-full bg-background p-0.5" role="radiogroup" aria-label="What to compare">
          {(
            [
              ["basic", "Wind"],
              ["rain", "Rain & cloud"],
              ["waves", "Waves"],
            ] as const
          ).map(([id, t]) => (
            <button key={id} type="button" role="radio" aria-checked={view === id} onClick={() => setView(id)} className={`h-9 rounded-full px-3 text-t13 font-semibold ${view === id ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex rounded-full bg-background p-0.5" role="radiogroup" aria-label="How many days">
          {([3, 7] as const).map((d) => (
            <button key={d} type="button" role="radio" aria-checked={days === d} onClick={() => setDays(d)} className={`h-9 rounded-full px-3 text-t13 font-semibold ${days === d ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
              {d} days
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 text-t14 leading-snug font-semibold">{summary}</p>

      {view === "waves" && waves.isLoading ? <p className="mt-2 text-t14 text-muted-foreground">Loading the wave models…</p> : null}
      {view === "waves" && !waves.isLoading && !waveModels.length ? <p className="mt-2 text-t14 text-muted-foreground">No wave models here (inland, or no signal).</p> : null}

      <div className="rp-noscroll mt-2 overflow-x-auto overscroll-x-contain">
        <table className="border-separate border-spacing-y-0.5 text-t12 tabular-nums">
          <thead>
            <tr>
              <th className={label} />
              {cols.map((t) => (
                <th key={t} className={`${colW} px-0 text-center font-normal text-muted-foreground ${dayStarts.has(t) ? "border-l border-border" : ""}`}>
                  {dayStarts.has(t) ? <span className="block text-t11 font-semibold text-foreground">{new Date(t).toLocaleDateString([], { weekday: "short", day: "numeric" })}</span> : <span className="block text-t11">&nbsp;</span>}
                  {new Date(t).toLocaleTimeString([], { hour: "numeric" }).replace(/\s/g, "").toLowerCase()}
                </th>
              ))}
            </tr>
            <tr>
              <th className={`${label} text-t12 font-semibold text-foreground`}>Agreement</th>
              {agreement.map((a) => (
                <td key={a.at} className="px-0.5">
                  <span
                    className="block h-6 rounded text-center text-t11 leading-6 font-semibold text-white"
                    style={{ background: a.level ? LEVEL_BG[a.level] : "transparent" }}
                    title={a.level ? `Models ${LEVEL_TEXT[a.level]}: ${view === "waves" ? formatDepth(a.spread) : `${Math.round(a.spread)} kn`} apart` : ""}
                  >
                    {a.level ? (view === "waves" ? a.spread.toFixed(1) : `±${Math.round(a.spread / 2)}`) : ""}
                  </span>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((m) => {
              const off = hidden.includes(m.id);
              return (
                <tr key={m.id} className={off ? "opacity-40" : ""}>
                  <th className={label}>
                    <span className="block truncate text-t13 font-semibold text-foreground">
                      {m.label.replace(/^(NOAA|DWD|UK Met Office) ?/, (x) => (x.startsWith("UK") ? "UKMO" : "")).replace(/ IFS$/, "")}
                      {m.resKm ? <span className="ml-1 text-t11 font-normal text-muted-foreground">{m.resKm}km</span> : null}
                    </span>
                    <span className="flex items-center gap-1 text-t11 font-normal text-muted-foreground">
                      <button type="button" aria-label={pinned === m.id ? `Unpin ${m.label}` : `Pin ${m.label} to the top`} className="grid size-6 place-items-center" onClick={() => setPinned(m.id)}>
                        {pinned === m.id ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                      </button>
                      <button type="button" aria-label={off ? `Show ${m.label}` : `Hide ${m.label}`} className="grid size-6 place-items-center" onClick={() => setHidden(m.id)}>
                        {off ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      </button>
                    </span>
                  </th>
                  {cols.map((at) => {
                    if (view === "waves") {
                      const w = sampleAt(m.hours as WaveHour[], at, 3 * H);
                      return (
                        <td key={at} className="px-0.5 text-center">
                          {w ? (
                            <span className="block rounded bg-background py-0.5">
                              <span className="block font-semibold">{w.heightM.toFixed(1)}</span>
                              <span className="block text-t11 text-muted-foreground">
                                <Arrow fromDeg={w.dirDeg} /> {w.periodS != null ? `${Math.round(w.periodS)}s` : ""}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">–</span>
                          )}
                        </td>
                      );
                    }
                    const h = sampleAt(m.hours as WxHour[], at);
                    if (!h) {
                      return (
                        <td key={at} className="px-0.5 text-center text-muted-foreground">
                          –
                        </td>
                      );
                    }
                    if (view === "rain") {
                      return (
                        <td key={at} className="px-0.5 text-center">
                          <span className="block rounded bg-background py-0.5">
                            <span className={`block font-semibold ${h.precipMm >= 0.2 ? "text-sky-300" : "text-muted-foreground"}`}>{h.precipMm >= 0.2 ? h.precipMm.toFixed(1) : "·"}</span>
                            <span className="block text-t11 text-muted-foreground">{Math.round(h.cloudPct)}%</span>
                          </span>
                        </td>
                      );
                    }
                    const c = windColor(h.windKn);
                    return (
                      <td key={at} className="px-0.5 text-center">
                        <span className="block rounded py-0.5" style={{ background: c.bg, color: c.fg }} title={`${Math.round(h.windKn)} kn ${windCardinal(h.dirDeg)}`}>
                          <span className="block font-semibold">
                            <Arrow fromDeg={h.dirDeg} /> {Math.round(h.windKn)}
                          </span>
                          <span className="block text-t11 opacity-80">{h.gustKn != null ? Math.round(h.gustKn) : ""}</span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-t12 leading-snug text-muted-foreground">
        {view === "waves"
          ? "Wave height (m), arrow to where the waves go, period in seconds. Waves on the weather map use the Open-Meteo marine model."
          : view === "rain"
            ? "Rain in mm an hour (· = dry) and cloud cover. Agreement is on the wind."
            : "Wind (kn), arrow to where it blows, gust underneath. ± is half the gap between the models."}{" "}
        Pin a model to keep it on top; hide one to leave it out of the agreement.
      </p>
    </div>
  );
}
