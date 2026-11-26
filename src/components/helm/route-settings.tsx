import { Button } from "@/components/ui/button";
import { depthSuffix, formatDepth, fromDepth, toDepth } from "@/lib/units";
import { wantedDepthM } from "@/lib/routing/min-depth";
import { BOAT_TYPES, defaultTune, type PolarTune } from "@/lib/routing/polar";
import { BoatTypePicker } from "@/components/helm/boat-type";
import { ROUTE_MODELS } from "@/lib/routing/fetch-field";
import { TREAT_LABEL, type Treat } from "@/lib/routing/storm";
import type { RouteRules } from "@/lib/routing/router";
import type { SailDef } from "@/lib/routing/sails";
import { ROUTE_PRESETS, boatPerfOf, useHelm, useUnitsKey, type RoutePreset } from "@/store/helm";
import { EMPTY_LEARNED, MIN_SAMPLES, polarInsight } from "@/lib/routing/learned";

const label = "mb-1 text-t12 text-muted-foreground";

export function Stepper({
  label: name,
  value,
  step,
  onChange,
  show,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (v: number) => void;
  show?: (v: number) => string;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-1.5 py-1 text-center">
      <p className="text-t12 text-muted-foreground">{name}</p>
      <div className="flex items-center justify-between gap-1">
        <Button size="icon-sm" variant="ghost" aria-label={`Less ${name}`} onClick={() => onChange(Math.max(0, +(value - step).toFixed(2)))}>
          −
        </Button>
        <span className="font-display text-base font-semibold tabular-nums">{show ? show(value) : value}</span>
        <Button size="icon-sm" variant="ghost" aria-label={`More ${name}`} onClick={() => onChange(+(value + step).toFixed(2))}>
          +
        </Button>
      </div>
    </div>
  );
}

/** One line under the planner's Go button: what the router will do. */
export function SettingsSummary() {
  const p = useHelm((s) => s.routePrefs);
  const hull = useHelm((s) => s.hull);
  const preset = p.preset === "custom" ? "Custom" : ROUTE_PRESETS[p.preset].label;
  const boat = BOAT_TYPES.find((b) => b.id === p.boatType)?.label ?? "";
  const motor =
    p.boatType === "motor"
      ? `cruise ${p.motorKn} kn${p.fuelLph ? `, ${p.fuelLph} L/h` : ""}`
      : p.motorBelowKn || p.motorWindBelowKn
        ? `motor ${p.motorBelowKn ? `<${p.motorBelowKn} kn boat` : ""}${p.motorBelowKn && p.motorWindBelowKn ? " / " : ""}${p.motorWindBelowKn ? `<${p.motorWindBelowKn} kn wind` : ""}`
        : "no engine";
  return (
    <p className="text-t14 leading-snug text-muted-foreground">
      <span className="font-semibold text-foreground">{preset}</span> · {boat} {hull.loaM.toFixed(1)} m · limits{" "}
      {p.limits.maxWindKn}/{p.limits.maxGustKn} kn, {formatDepth(p.limits.maxWaveM)} · {motor} · storms{" "}
      {TREAT_LABEL[p.rules.thunder].toLowerCase()} · {p.models.length} model{p.models.length === 1 ? "" : "s"}
    </p>
  );
}

function TreatRow({ title, detail, value, onChange }: { title: string; detail: string; value: Treat; onChange: (t: Treat) => void }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-t13 leading-snug text-muted-foreground">{detail}</p>
      <div className="mt-1.5 grid grid-cols-4 gap-1">
        {(["avoid", "penalise", "warn", "ignore"] as Treat[]).map((t) => (
          <Button key={t} size="sm" className="h-10 px-1 text-t13" variant={value === t ? "default" : "outline"} onClick={() => onChange(t)}>
            {TREAT_LABEL[t]}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** The Weather Routing Settings page. Every change is remembered. */
export function RouteSettings({ onDone }: { onDone: () => void }) {
  const p = useHelm((s) => s.routePrefs);
  const set = useHelm((s) => s.setRoutePrefs);
  const hull = useHelm((s) => s.hull);
  const rule = (k: keyof RouteRules) => (v: RouteRules[typeof k]) => set({ rules: { ...p.rules, [k]: v } as RouteRules });
  const applyPreset = (id: Exclude<RoutePreset, "custom">) => {
    const pre = ROUTE_PRESETS[id].prefs;
    set({ ...pre, limits: { ...p.limits, ...pre.limits }, rules: { ...p.rules, ...pre.rules }, preset: id });
  };
  const toggleSail = (s: SailDef) => set({ sails: p.sails.map((x) => (x.id === s.id ? { ...x, owned: !x.owned } : x)) });
  const main = p.sails.find((s) => s.kind === "main");
  const motorBoat = p.boatType === "motor";
  // Racing (no engine) means nothing for a motor boat.
  const presets = (Object.keys(ROUTE_PRESETS) as Exclude<RoutePreset, "custom">[]).filter((id) => !(motorBoat && id === "racing"));

  return (
    <div className="grid gap-3">
      <div>
        <p className={label}>Starting point</p>
        <div className="grid gap-1.5">
          {presets.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={`rounded-md border px-3 py-2 text-left ${p.preset === id ? "border-primary bg-primary/10" : "border-border bg-background"}`}
            >
              <p className="text-sm font-semibold">{ROUTE_PRESETS[id].label}</p>
              <p className="text-t13 leading-snug text-muted-foreground">{motorBoat ? ROUTE_PRESETS[id].motorDetail : ROUTE_PRESETS[id].detail}</p>
            </button>
          ))}
          {p.preset === "custom" ? <p className="text-t13 text-muted-foreground">Custom: your own mix of the settings below.</p> : null}
        </div>
      </div>

      <div>
        <p className={label}>Boat ({hull.loaM.toFixed(1)} m, set in the Boat panel)</p>
        <BoatTypePicker />
        {motorBoat ? <p className="mt-1 text-t13 text-muted-foreground">Routes at your cruising speed, slowed by head seas and helped or held back by the current.</p> : null}
      </div>

      <div>
        <p className={label}>Your limits (never exceeded in any plan)</p>
        <div className="grid grid-cols-3 gap-1.5">
          <Stepper label="Wind kn" value={p.limits.maxWindKn} step={1} onChange={(v) => set({ limits: { ...p.limits, maxWindKn: v } })} />
          <Stepper label="Gust kn" value={p.limits.maxGustKn} step={1} onChange={(v) => set({ limits: { ...p.limits, maxGustKn: v } })} />
          <Stepper label="Seas" value={p.limits.maxWaveM} step={0.25} show={(v) => formatDepth(v)} onChange={(v) => set({ limits: { ...p.limits, maxWaveM: v } })} />
        </div>
      </div>

      <MotorSettings />

      <div className="grid gap-1.5">
        <p className={label}>Hazards</p>
        <TreatRow
          title="Thunderstorms"
          detail="From CAPE, lifted index and rain: thresholds rise with air temperature. Models place storms roughly."
          value={p.rules.thunder}
          onChange={rule("thunder")}
        />
        <TreatRow title="Rain squalls" detail="Heavy rain (3 mm/h or more) with gusts of 25 kn or more." value={p.rules.squall} onChange={rule("squall")} />
        <TreatRow
          title="Wind over tide"
          detail="Seas raised and steepened where the current runs against the waves. Avoid skips seas raised 30% or more."
          value={p.rules.windOverTide}
          onChange={rule("windOverTide")}
        />
        <TreatRow title="Arriving after dark" detail="Avoid picks daylight arrivals when any departure allows one." value={p.rules.night} onChange={rule("night")} />
      </div>

      <div>
        <p className={label}>Speed or comfort</p>
        <div className="grid grid-cols-5 gap-1">
          {[0, 0.25, 0.5, 0.75, 1].map((w, i) => (
            <Button key={w} size="sm" className="h-10 px-0 text-t13" variant={p.rules.comfortWeight === w ? "default" : "outline"} onClick={() => set({ rules: { ...p.rules, comfortWeight: w } })}>
              {["Speed", "", "Balanced", "", "Comfort"][i] || "·"}
            </Button>
          ))}
        </div>
        <p className="mt-1 text-t13 text-muted-foreground">
          {motorBoat ? "Shapes the Most comfortable plan: head seas, steep seas, gusts and rolling." : "Shapes the Most comfortable plan: upwind work, steep seas, gusts and rolling."}
        </p>
      </div>

      {motorBoat ? null : (
      <div>
        <p className={label}>Sails you carry (sail plan uses apparent wind)</p>
        <div className="grid gap-1">
          {p.sails.map((s) => (
            <button
              key={s.id}
              type="button"
              role="switch"
              aria-checked={s.owned}
              onClick={() => toggleSail(s)}
              className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-left"
            >
              <span className="min-w-0">
                <span className="block text-sm">{s.name}</span>
                <span className="block text-t13 text-muted-foreground">
                  {s.kind === "main" ? "Reefs by apparent wind" : `AWA ${s.awaMin}–${s.awaMax}° · AWS ${s.awsMin}–${s.awsMax} kn`}
                </span>
              </span>
              <span className={`text-t13 font-semibold ${s.owned ? "text-primary" : "text-muted-foreground"}`}>{s.owned ? "On board" : "No"}</span>
            </button>
          ))}
        </div>
        {main?.owned && main.reefs ? (
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <Stepper
                key={i}
                label={`Reef ${i + 1} at`}
                value={main.reefs![i]!}
                step={1}
                show={(v) => `${v} kn`}
                onChange={(v) =>
                  set({
                    sails: p.sails.map((x) =>
                      x.id === "main" ? { ...x, reefs: x.reefs!.map((r, j) => (j === i ? v : r)) as [number, number, number] } : x,
                    ),
                  })
                }
              />
            ))}
          </div>
        ) : null}
        <p className="mt-1 text-t13 text-muted-foreground">Ranges are typical sailmaker figures. Your sailmaker&apos;s chart is the better guide.</p>
      </div>
      )}

      <DepthLimitSettings />

      {motorBoat ? null : <PolarTuneSettings />}

      {motorBoat ? null : <LearnedPolarSettings />}

      <div>
        <p className={label}>Weather models (first is the main one)</p>
        <div className="grid grid-cols-4 gap-1.5">
          {ROUTE_MODELS.map((m) => {
            const on = p.models.includes(m.id);
            return (
              <Button
                key={m.id}
                size="sm"
                variant={on ? "default" : "outline"}
                aria-pressed={on}
                onClick={() => {
                  const next = on ? p.models.filter((x) => x !== m.id) : [...p.models, m.id];
                  if (next.length) set({ models: next });
                }}
              >
                {m.label}
              </Button>
            );
          })}
        </div>
        <p className="mt-1 text-t13 text-muted-foreground">More models give a better sense of confidence but take longer to download.</p>
      </div>

      <Button size="lg" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

/** Motoring rules, as in most routing software. */
export function MotorSettings() {
  const prefs = useHelm((s) => s.routePrefs);
  const setPrefs = useHelm((s) => s.setRoutePrefs);
  const fuel = (
    <div className="grid grid-cols-[1fr_8rem] items-center gap-2">
      <span className="text-sm">Fuel at cruise (0 = hide)</span>
      <Stepper label="L/h" value={prefs.fuelLph} step={0.1} show={(v) => v.toFixed(1)} onChange={(v) => setPrefs({ fuelLph: Math.max(0, Math.round(v * 10) / 10) })} />
    </div>
  );
  if (prefs.boatType === "motor") {
    return (
      <div className="grid gap-1.5">
        <p className={label}>Engine</p>
        <div className="grid grid-cols-[1fr_8rem] items-center gap-2">
          <span className="text-sm">Cruising speed (calm water)</span>
          <Stepper label="kn" value={prefs.motorKn} step={prefs.motorKn >= 12 ? 1 : 0.5} onChange={(v) => setPrefs({ motorKn: Math.min(45, Math.max(2, v)) })} />
        </div>
        {fuel}
      </div>
    );
  }
  const row = "flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-left text-sm";
  const pill = (on: boolean) => `text-t13 font-semibold ${on ? "text-primary" : "text-muted-foreground"}`;
  return (
    <div>
      <p className={label}>Motoring</p>
      <div className="grid gap-1.5">
        <div className={row}>
          <button type="button" role="switch" aria-checked={prefs.motorBelowKn > 0} className="flex flex-1 items-center justify-between gap-2 text-left" onClick={() => setPrefs({ motorBelowKn: prefs.motorBelowKn > 0 ? 0 : 3 })}>
            <span>Motor if boat speed is below</span>
            <span className={pill(prefs.motorBelowKn > 0)}>{prefs.motorBelowKn > 0 ? "On" : "Off"}</span>
          </button>
          {prefs.motorBelowKn > 0 ? (
            <div className="w-28 shrink-0">
              <Stepper label="kn" value={prefs.motorBelowKn} step={0.5} onChange={(v) => setPrefs({ motorBelowKn: v })} />
            </div>
          ) : null}
        </div>
        <div className={row}>
          <button type="button" role="switch" aria-checked={prefs.motorWindBelowKn > 0} className="flex flex-1 items-center justify-between gap-2 text-left" onClick={() => setPrefs({ motorWindBelowKn: prefs.motorWindBelowKn > 0 ? 0 : 6 })}>
            <span>Motor if wind is below</span>
            <span className={pill(prefs.motorWindBelowKn > 0)}>{prefs.motorWindBelowKn > 0 ? "On" : "Off"}</span>
          </button>
          {prefs.motorWindBelowKn > 0 ? (
            <div className="w-28 shrink-0">
              <Stepper label="kn" value={prefs.motorWindBelowKn} step={1} onChange={(v) => setPrefs({ motorWindBelowKn: v })} />
            </div>
          ) : null}
        </div>
        {prefs.motorBelowKn > 0 || prefs.motorWindBelowKn > 0 ? (
          <>
            <div className="grid grid-cols-[1fr_8rem] items-center gap-2 px-1">
              <span className="text-sm">Motoring speed</span>
              <Stepper label="kn" value={prefs.motorKn} step={0.5} onChange={(v) => setPrefs({ motorKn: v })} />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" variant={!prefs.motorOnNose ? "default" : "outline"} onClick={() => setPrefs({ motorOnNose: false })}>
                Wind on the nose: tack
              </Button>
              <Button size="sm" variant={prefs.motorOnNose ? "default" : "outline"} onClick={() => setPrefs({ motorOnNose: true })}>
                Wind on the nose: motor
              </Button>
            </div>
          </>
        ) : null}
      </div>
      {fuel}
    </div>
  );
}

/** The skipper's own speeds in 15 kn of true wind and how close the boat points. */
function PolarTuneSettings() {
  const p = useHelm((s) => s.routePrefs);
  const set = useHelm((s) => s.setRoutePrefs);
  const loa = useHelm((s) => s.hull.loaM);
  const t = p.tune;
  const base = defaultTune(boatPerfOf({ ...p, tune: null, useLearned: false }, loa));
  const edit = (k: keyof PolarTune) => (v: number) =>
    set({ tune: { ...(t ?? base), [k]: k === "pointingDeg" ? Math.round(Math.max(20, Math.min(60, v))) : Math.max(0.5, Math.round(v * 10) / 10) } });
  const kn = (v: number) => v.toFixed(1);
  return (
    <div>
      <p className={label}>Your boat&apos;s speeds (in 15 kn of true wind)</p>
      <div className="rounded-md border border-border bg-background px-3 py-2">
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(t)}
          className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm"
          onClick={() => set({ tune: t ? null : base })}
        >
          <span>Use my numbers instead of the built-in polar</span>
          <span className={`text-t13 font-semibold ${t ? "text-primary" : "text-muted-foreground"}`}>{t ? "On" : "Off"}</span>
        </button>
        {t ? (
          <>
            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
              <Stepper label="Pointing °" value={t.pointingDeg} step={1} show={(v) => `${v}°`} onChange={edit("pointingDeg")} />
              <Stepper label={`Close-hauled (${t.pointingDeg}°)`} value={t.closeHauledKn} step={0.1} show={kn} onChange={edit("closeHauledKn")} />
              <Stepper label="Close reach (60°)" value={t.closeReachKn} step={0.1} show={kn} onChange={edit("closeReachKn")} />
              <Stepper label="Beam reach (90°)" value={t.beamKn} step={0.1} show={kn} onChange={edit("beamKn")} />
              <Stepper label="Run (180°)" value={t.runKn} step={0.1} show={kn} onChange={edit("runKn")} />
              <Button variant="outline" className="h-auto min-h-11 text-t13" onClick={() => set({ tune: base })}>
                Back to built-in values
              </Button>
            </div>
            <p className="mt-1.5 text-t13 leading-snug text-muted-foreground">
              Knots through the water, flat sea. Other wind speeds and angles follow the built-in shape, scaled to
              match. The router won&apos;t sail closer than {t.pointingDeg}° to the true wind.
            </p>
          </>
        ) : (
          <p className="mt-0.5 text-t13 leading-snug text-muted-foreground">
            Built-in for a {loa.toFixed(1)} m {p.boatType === "catamaran" ? "catamaran" : "monohull"}: close-hauled {kn(base.closeHauledKn)},
            close reach {kn(base.closeReachKn)}, beam {kn(base.beamKn)}, run {kn(base.runKn)} kn, pointing {base.pointingDeg}°.
          </p>
        )}
      </div>
    </div>
  );
}

/** The boat's own polar, learned while sailing: summary, use it for routes, reset. */
function LearnedPolarSettings() {
  const p = useHelm((s) => s.routePrefs);
  const set = useHelm((s) => s.setRoutePrefs);
  const bins = Object.values(p.learned.bins);
  const trusted = bins.filter((b) => b.n >= MIN_SAMPLES);
  const avg = trusted.length ? trusted.reduce((a, b) => a + b.ratio, 0) / trusted.length : null;
  const insight = polarInsight(p.learned);
  return (
    <div>
      <p className={label}>Your boat&apos;s polar</p>
      <div className="rounded-md border border-border px-3 py-2 text-t15 leading-snug">
        {p.learned.samples === 0 ? (
          <p className="text-muted-foreground">
            Nothing learned yet. While you sail with the engine off, the app compares your speed with the polar and
            learns how this boat really goes.
          </p>
        ) : (
          <p>
            {p.learned.samples} samples, {trusted.length} of {bins.length} wind bins trusted
            {avg != null ? `, on average ${Math.round(avg * 100)}% of the built-in polar` : ""}.
          </p>
        )}
        {insight ? <p className="mt-1 text-primary">{insight}</p> : null}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          variant={p.useLearned ? "default" : "outline"}
          aria-pressed={p.useLearned}
          disabled={!trusted.length}
          onClick={() => set({ useLearned: !p.useLearned })}
        >
          {p.useLearned ? "Routing with learned" : "Route with learned"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={p.learned.samples === 0}
          onClick={() => {
            if (window.confirm("Forget everything learned about this boat's speed?")) set({ learned: EMPTY_LEARNED, useLearned: false });
          }}
        >
          Reset learned
        </Button>
      </div>
      <p className="mt-1 text-t13 text-muted-foreground">
        Learned bins are used only once they have {MIN_SAMPLES} clean samples; elsewhere the built-in polar is used.
        Wind comes from the forecast, so treat it as a trend, not a trim tool.
      </p>
    </div>
  );
}

/** How deep the water must be for a route, and whether that is at mean sea level or low tide. */
function DepthLimitSettings() {
  useUnitsKey();
  const prefs = useHelm((s) => s.routePrefs);
  const setPrefs = useHelm((s) => s.setRoutePrefs);
  const draftM = useHelm((s) => s.hull.draftM);
  const want = wantedDepthM({ minDepthM: prefs.minDepthM, depthAt: prefs.depthAt }, draftM);
  return (
    <div>
      <p className={label}>Keep out of water shallower than</p>
      <div className="grid grid-cols-[1fr_8rem] items-center gap-2">
        <span className="text-sm">
          {prefs.minDepthM == null ? `Draft + ${formatDepth(1)} (${formatDepth(want)})` : formatDepth(want)}
        </span>
        <Stepper
          label={depthSuffix()}
          value={toDepth(want)}
          step={depthSuffix() === "m" ? 0.5 : 1}
          show={(v) => v.toFixed(1)}
          onChange={(v) => setPrefs({ minDepthM: Math.max(0.5, Math.min(50, Math.round(fromDepth(v) * 10) / 10)) })}
        />
      </div>
      {prefs.minDepthM != null ? (
        <Button variant="ghost" size="sm" className="mt-1" onClick={() => setPrefs({ minDepthM: null })}>
          Back to draft + {formatDepth(1)}
        </Button>
      ) : null}
      <div className="mt-1.5 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Measure the depth at">
        {(
          [
            ["low", "At low tide (safer)"],
            ["msl", "At mean sea level"],
          ] as const
        ).map(([id, text]) => (
          <Button
            key={id}
            size="sm"
            role="radio"
            aria-checked={prefs.depthAt === id}
            variant={prefs.depthAt === id ? "default" : "outline"}
            onClick={() => setPrefs({ depthAt: id })}
          >
            {text}
          </Button>
        ))}
      </div>
      <p className="mt-1 text-t13 leading-snug text-muted-foreground">
        From the depth model: about 30 m detail on the Great Barrier Reef, much coarser elsewhere, and no bommies. It keeps routes off banks and reef flats, not off every rock. Low tide uses the lowest tide this year where you start.
      </p>
    </div>
  );
}
