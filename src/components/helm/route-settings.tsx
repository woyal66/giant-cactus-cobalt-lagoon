import { Button } from "@/components/ui/button";
import { formatDepth } from "@/lib/units";
import { BOAT_TYPES } from "@/lib/routing/polar";
import { ROUTE_MODELS } from "@/lib/routing/fetch-field";
import { TREAT_LABEL, type Treat } from "@/lib/routing/storm";
import type { RouteRules } from "@/lib/routing/router";
import type { SailDef } from "@/lib/routing/sails";
import { ROUTE_PRESETS, useHelm, type RoutePreset } from "@/store/helm";

const label = "mb-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase";

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
      <p className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{name}</p>
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
      ? `${p.motorKn} kn`
      : p.motorBelowKn || p.motorWindBelowKn
        ? `motor ${p.motorBelowKn ? `<${p.motorBelowKn} kn boat` : ""}${p.motorBelowKn && p.motorWindBelowKn ? " / " : ""}${p.motorWindBelowKn ? `<${p.motorWindBelowKn} kn wind` : ""}`
        : "no engine";
  return (
    <p className="text-[12px] leading-snug text-muted-foreground">
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
      <p className="text-[11px] leading-snug text-muted-foreground">{detail}</p>
      <div className="mt-1.5 grid grid-cols-4 gap-1">
        {(["avoid", "penalise", "warn", "ignore"] as Treat[]).map((t) => (
          <Button key={t} size="sm" className="h-8 px-1 text-[11px]" variant={value === t ? "default" : "outline"} onClick={() => onChange(t)}>
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

  return (
    <div className="grid gap-3">
      <div>
        <p className={label}>Starting point</p>
        <div className="grid gap-1.5">
          {(Object.keys(ROUTE_PRESETS) as Exclude<RoutePreset, "custom">[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={`rounded-md border px-3 py-2 text-left ${p.preset === id ? "border-primary bg-primary/10" : "border-border bg-background"}`}
            >
              <p className="text-sm font-semibold">{ROUTE_PRESETS[id].label}</p>
              <p className="text-[11px] leading-snug text-muted-foreground">{ROUTE_PRESETS[id].detail}</p>
            </button>
          ))}
          {p.preset === "custom" ? <p className="text-[11px] text-muted-foreground">Custom: your own mix of the settings below.</p> : null}
        </div>
      </div>

      <div>
        <p className={label}>Boat ({hull.loaM.toFixed(1)} m, set in the Boat panel)</p>
        <div className="grid grid-cols-2 gap-1.5">
          {BOAT_TYPES.map((b) => (
            <Button key={b.id} size="sm" variant={p.boatType === b.id ? "default" : "outline"} onClick={() => set({ boatType: b.id })}>
              {b.label}
            </Button>
          ))}
        </div>
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
            <Button key={w} size="sm" className="h-8 px-0 text-[11px]" variant={p.rules.comfortWeight === w ? "default" : "outline"} onClick={() => set({ rules: { ...p.rules, comfortWeight: w } })}>
              {["Speed", "", "Balanced", "", "Comfort"][i] || "·"}
            </Button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Shapes the Most comfortable plan: upwind work, steep seas, gusts and rolling.</p>
      </div>

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
                <span className="block text-[11px] text-muted-foreground">
                  {s.kind === "main" ? "Reefs by apparent wind" : `AWA ${s.awaMin}–${s.awaMax}° · AWS ${s.awsMin}–${s.awsMax} kn`}
                </span>
              </span>
              <span className={`text-[11px] font-semibold uppercase ${s.owned ? "text-primary" : "text-muted-foreground"}`}>{s.owned ? "On board" : "No"}</span>
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
        <p className="mt-1 text-[11px] text-muted-foreground">Ranges are typical sailmaker figures. Your sailmaker&apos;s chart is the better guide.</p>
      </div>

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
        <p className="mt-1 text-[11px] text-muted-foreground">More models give a better sense of confidence but take longer to download.</p>
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
  if (prefs.boatType === "motor") {
    return (
      <div className="grid grid-cols-[1fr_8rem] items-center gap-2">
        <span className="text-sm">Cruising speed</span>
        <Stepper label="Motor kn" value={prefs.motorKn} step={0.5} onChange={(v) => setPrefs({ motorKn: v })} />
      </div>
    );
  }
  const row = "flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-left text-sm";
  const pill = (on: boolean) => `text-[11px] font-semibold uppercase ${on ? "text-primary" : "text-muted-foreground"}`;
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
    </div>
  );
}
