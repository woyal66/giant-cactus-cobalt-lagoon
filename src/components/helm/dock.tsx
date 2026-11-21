import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Anchor,
  BookOpen,
  Map as MapIcon,
  Pencil,
  Radio,
  Route as RouteIcon,
  Square,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { rodeMath, formatTideClock } from "@/lib/anchor";
import { gpsReachM } from "@/lib/boat";
import { unlockAlarmAudio } from "@/hooks/helm-runtime";
import { armWatchAlerts } from "@/lib/watch-notify";
import { useWx } from "@/hooks/weather";
import { fetchTideRise, latDatumM, tideRiseAt, toLatM } from "@/lib/tides";
import type { SeaState } from "@/lib/weather";
import { AnchorWxCard } from "@/components/helm/weather";
import { useHelm } from "@/store/helm";
import {
  depthSuffix,
  depthWheel,
  formatLength,
  fromDepth,
  fromLength,
  lengthSuffix,
  lengthWheel,
  toDepth,
  toLength,
} from "@/lib/units";

export function BottomDock() {
  const panel = useHelm((s) => s.panel);
  const drawMode = useHelm((s) => s.drawMode);
  const draft = useHelm((s) => s.draft);
  const crumb = useHelm((s) => s.crumb);
  const setPanel = useHelm((s) => s.setPanel);
  const setDrawMode = useHelm((s) => s.setDrawMode);
  const popDraft = useHelm((s) => s.popDraft);
  const reverseTrack = useHelm((s) => s.reverseTrack);
  const canReverse = draft.length >= 2 || crumb.length >= 2;
  const anchorStep = useHelm((s) => s.anchorStep);
  const watching = useHelm((s) => Boolean(s.anchor?.radiusLocked));
  const breach = useHelm((s) => s.alarmOn || s.gpsLost);

  if (anchorStep) return <AnchorSetBar />;

  const toggle = (id: NonNullable<typeof panel>) =>
    setPanel(panel === id ? null : id);

  if (drawMode === "record") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2 pb-[max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-[var(--shadow-border)]">
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              const ok = useHelm.getState().finishRecording();
              if (!ok) toast("Move off the start, then stop.");
            }}
          >
            <Square className="size-4" />
            Stop
          </Button>
          <Button
            variant="helm"
            onClick={() => {
              useHelm.getState().setDraft([]);
              setDrawMode("idle");
            }}
          >
            Discard
          </Button>
        </div>
        <p className="pointer-events-none mt-1.5 text-center text-t13 text-foreground">
          Recording from the start. Stop marks the end.
        </p>
      </div>
    );
  }

  if (drawMode !== "idle") {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2 pb-[max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]">
        <div className="pointer-events-auto mx-auto flex max-w-lg items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-[var(--shadow-border)]">
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => setDrawMode("idle")}
          >
            <Square className="size-4" />
            Stop
          </Button>
          <Button
            variant="helm"
            disabled={!canReverse}
            onClick={() => reverseTrack()}
          >
            <Undo2 className="size-4" />
            Reverse
          </Button>
          <Button
            variant="helm"
            disabled={draft.length === 0}
            onClick={popDraft}
          >
            Undo
          </Button>
          <Button
            variant="default"
            disabled={draft.length < 1}
            onClick={() => setPanel("save")}
          >
            Save {draft.length ? `(${draft.length})` : ""}
          </Button>
        </div>
        <p className="pointer-events-none mt-1.5 text-center text-t13 text-foreground">
          {drawMode === "draw"
            ? "Tap the water to drop waypoints along the safe colour."
            : "Logging your GPS trail. Reverse follows it back out."}
        </p>
      </div>
    );
  }

  return (
    <nav className="pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2 pb-[max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]">
      <div className="pointer-events-auto mx-auto grid max-w-lg grid-cols-6 gap-0.5 rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-border)]">
        <DockBtn
          active={panel === "atlas"}
          label="Places"
          onClick={() => toggle("atlas")}
        >
          <MapIcon />
        </DockBtn>
        <DockBtn
          active={panel === "passages"}
          label="Tracks"
          onClick={() => toggle("passages")}
        >
          <BookOpen />
        </DockBtn>
        <DockBtn
          active={panel === "route"}
          label="Route"
          onClick={() => {
            const s = useHelm.getState();
            if (s.panel === "route" || s.tapMode.startsWith("route-")) s.endRoutePlan();
            else s.beginRoutePlan();
          }}
        >
          <RouteIcon />
        </DockBtn>
        <DockBtn
          active={panel === "anchor"}
          label={breach ? "Alarm" : watching ? "Watch" : "Anchor"}
          // Filled only while the watch runs (red on alarm), so the dock shows the watch state.
          emphasize={watching}
          danger={breach}
          onClick={() => {
            const s = useHelm.getState();
            // On watch: open the anchor sheet (settings, test, stop with a confirm).
            if (s.anchor) {
              toggle("anchor");
              return;
            }
            unlockAlarmAudio();
            s.beginAnchorSet();
          }}
        >
          <Anchor />
        </DockBtn>
        <DockBtn
          active={false}
          label="Start"
          onClick={() => {
            useHelm.getState().setDraft([]);
            useHelm.getState().clearCrumb();
            setDrawMode("record");
          }}
        >
          <Radio />
        </DockBtn>
        <DockBtn
          active={false}
          label="Draw"
          onClick={() => {
            useHelm.getState().setDraft([]);
            setDrawMode("draw");
          }}
        >
          <Pencil />
        </DockBtn>
      </div>
    </nav>
  );
}

function DockBtn({
  active,
  label,
  children,
  onClick,
  emphasize,
  danger,
}: {
  active: boolean;
  label: string;
  children: ReactNode;
  onClick: () => void;
  emphasize?: boolean;
  danger?: boolean;
}) {
  return (
    <Button
      variant={danger ? "danger" : active || emphasize ? "default" : "ghost"}
      onClick={onClick}
      className="h-14 flex-col gap-1 rounded-lg px-1 text-t13 font-semibold [&_svg]:size-5"
    >
      {children}
      {label}
    </Button>
  );
}

function AnchorSetBar() {
  const step = useHelm((s) => s.anchorStep);
  const rode = useHelm((s) => s.rode);
  const hull = useHelm((s) => s.hull);
  const boat = useHelm((s) => s.boat);
  const setRode = useHelm((s) => s.setRode);
  const setStep = useHelm((s) => s.setAnchorStep);
  const cancel = useHelm((s) => s.cancelAnchorSet);
  const undo = useHelm((s) => s.undoCircle);
  const accept = useHelm((s) => s.acceptCircle);
  const confirm = useHelm((s) => s.confirmAnchorAlarm);
  const swingShape = useHelm((s) => s.swingShape);
  const setSwingShape = useHelm((s) => s.setSwingShape);
  const fenceDraft = useHelm((s) => s.fenceDraft);
  const math = rodeMath(rode, gpsReachM(hull));
  const astern =
    boat?.heading != null ? Math.round((boat.heading + 180) % 360) : null;
  const tideKey =
    boat && (step === "depth" || step === "chain") && !rode.tideManual && !rode.tideHighAt
      ? `${boat.lat.toFixed(2)},${boat.lng.toFixed(2)}`
      : null;
  useEffect(() => {
    if (!tideKey) return;
    const [lat, lng] = tideKey.split(",").map(Number);
    if (lat == null || lng == null) return;
    let stop = false;
    fetchTideRise(lat, lng)
      .then((d) => {
        if (stop || !d.highAt) return;
        useHelm.getState().setRode({
          tideRiseM: d.riseM,
          tideHighAt: d.highAt,
          tideManual: false,
        });
      })
      .catch(() => {
        /* no signal: keep the tide the skipper entered */
      });
    return () => {
      stop = true;
    };
  }, [tideKey]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-2 pb-[max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]">
      <div className="pointer-events-auto mx-auto max-w-lg rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-border)]">
        {step === "place" ? (
          <Prompt
            kicker="Boat"
            title="Tap the chart where the boat is."
            onCancel={cancel}
          />
        ) : null}
        {step === "depth" || step === "chain" ? (
          <RodeDials
            depth={rode.depthM}
            chain={rode.chainM}
            scope={rode.scopeTarget}
            bowM={rode.bowM}
            tideM={rode.tideRiseM}
            highAt={rode.tideHighAt}
            draftM={hull.draftM}
            onCancel={cancel}
            onOk={(depthM, chainM, scopeTarget) => {
              setRode({ depthM, chainM, scopeTarget });
              setStep("scope");
            }}
          />
        ) : null}
        {step === "scope" ? (
          <div>
            <p className="text-t12 text-muted-foreground">Length</p>
            <p className="mt-1 font-display text-2xl leading-tight font-semibold">
              This length will be {formatLength(math.laybackM)}
              {astern != null ? `, ${astern}°` : " astern"}.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Scope {math.scopeNow.toFixed(1)}:1. Swing circle {formatLength(math.radiusM)}.
            </p>
            <Row
              cancel="Back"
              ok="OK"
              onCancel={() => setStep("depth")}
              onOk={undo}
            />
          </div>
        ) : null}
        {step === "circle" ? (
          <div className="grid grid-cols-4 gap-1.5">
            <Button
              variant={swingShape === "draw" ? "default" : "outline"}
              className="px-1"
              onClick={() => setSwingShape("draw")}
            >
              Draw
            </Button>
            <Button
              variant={swingShape === "circle" ? "default" : "outline"}
              className="px-1"
              onClick={() => setSwingShape("circle")}
            >
              Circle
            </Button>
            <Button variant="outline" className="px-1" onClick={cancel}>
              Cancel
            </Button>
            <Button
              className="px-1"
              disabled={swingShape === "draw" && fenceDraft.length < 3}
              onClick={accept}
            >
              Set
            </Button>
          </div>
        ) : null}
        {step === "watch" ? (
          <div className="max-h-[46dvh] overflow-y-auto">
            <p className="mb-2 text-t12 text-muted-foreground">
              Next 24 h
            </p>
            <AnchorWxCard />
            <Row
              cancel="Back"
              ok="Set alarm"
              onCancel={() => {
                useHelm.getState().setAnchorStep("circle");
                useHelm.getState().setTapMode("drop-anchor");
              }}
              onOk={() => {
                void armWatchAlerts();
                confirm();
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RodeDials({
  depth,
  chain,
  scope,
  bowM,
  tideM,
  highAt,
  draftM,
  onOk,
  onCancel,
}: {
  depth: number;
  chain: number;
  scope: number;
  bowM: number;
  tideM: number;
  highAt: number | null;
  draftM: number;
  onOk: (depthM: number, chainM: number, scope: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10) => void;
  onCancel: () => void;
}) {
  // Wheels run in the skipper's units; everything is converted back to metres on OK.
  const depthUnit = useHelm((s) => s.depthUnit);
  const lengthUnit = useHelm((s) => s.lengthUnit);
  const dw = depthWheel(depthUnit);
  const lw = lengthWheel(lengthUnit);
  const depths = useMemo(() => wheelValues(dw.min, dw.max, dw.step), [dw.min, dw.max, dw.step]);
  const chains = useMemo(() => wheelValues(lw.min, lw.max, lw.step), [lw.min, lw.max, lw.step]);
  const scopes = useMemo(() => wheelValues(1, 10, 1), []);
  const [depthV, setDepthV] = useState(() => nearest(depths, toDepth(depth, depthUnit)));
  const [chainV, setChainV] = useState(() => nearest(chains, toLength(chain, lengthUnit)));
  const [scopeN, setScopeN] = useState(() => nearest(scopes, scope));
  const depthM = fromDepth(depthV, depthUnit);
  const chainM = fromLength(chainV, lengthUnit);
  const rise = Math.max(0, tideM);
  const need = Math.ceil(scopeN * (depthM + bowM + rise));
  const enough = chainM + 0.05 >= need;
  const wx = useWx();
  const aboveLat = tideAboveLat(wx.data?.sea ?? null);
  const atLat = aboveLat == null ? depthM : depthM - aboveLat;
  const depthShort = draftM > atLat + 0.05;
  return (
    <div>
      <p className="text-t12 text-[#9eb0aa]">Rode</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Wheel label="Scope" value={scopeN} values={scopes} step={1} unit=":1" onChange={setScopeN} />
        <Wheel
          label="Chain"
          value={chainV}
          values={chains}
          step={lw.step}
          unit={lengthSuffix(lengthUnit)}
          tone={enough ? "ok" : "short"}
          onChange={setChainV}
        />
        <Wheel
          label="Depth"
          value={depthV}
          values={depths}
          step={dw.step}
          unit={depthSuffix(depthUnit)}
          tone={depthShort ? "short" : "plain"}
          onChange={setDepthV}
        />
      </div>
      <p className={`mt-2 text-center text-sm font-medium ${enough ? "text-emerald-300" : "text-destructive"}`}>
        {enough ? "Enough" : "Short"} · {formatLength(need)} for {scopeN}:1
        {rise > 0.05 ? ` at high water${highWhen(highAt)}` : ""}
      </p>
      <Row
        cancel="Cancel"
        ok="OK"
        onCancel={onCancel}
        onOk={() => onOk(depthM, chainM, scopeN as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10)}
      />
    </div>
  );
}

function tideAboveLat(sea: SeaState | null): number | null {
  if (!sea || sea.tideHours.length < 2) return null;
  const now = tideRiseAt(sea.tideTurns, sea.tideHours, Date.now());
  const datum =
    sea.tideOrigin?.kind === "station" ? 0 : (sea.latDatumM ?? latDatumM(sea.tideHours));
  return toLatM(now.nowM, datum);
}

function highWhen(at: number | null): string {
  if (!at) return "";
  const clock = formatTideClock(at);
  const then = new Date(at);
  const sameDay = new Date().toDateString() === then.toDateString();
  const when = sameDay ? clock : `${then.toLocaleDateString([], { weekday: "short" })} ${clock}`;
  return `, ${when}`;
}

function wheelValues(min: number, max: number, step: number) {
  const places = step < 1 ? 1 : 0;
  const count = Math.round((max - min) / step);
  return Array.from({ length: count + 1 }, (_, i) => Number((min + i * step).toFixed(places)));
}

function nearest(values: number[], n: number) {
  return values.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best));
}

function Wheel({
  label,
  value,
  values,
  step,
  unit = "m",
  tone = "plain",
  onChange,
}: {
  label: string;
  value: number;
  values: number[];
  step: number;
  unit?: string;
  tone?: "plain" | "ok" | "short";
  onChange: (n: number) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const item = 40;
  const places = step < 1 ? 1 : 0;
  const placed = useRef(false);
  const picked = tone === "ok" ? "text-emerald-300" : tone === "short" ? "text-destructive" : "text-[#f4fff8]";
  const hair = tone === "ok" ? "border-emerald-300/80" : tone === "short" ? "border-destructive/80" : "border-[#d7e6e1]/80";
  useEffect(() => {
    if (placed.current) return;
    const el = scroller.current;
    if (!el) return;
    const index = Math.max(0, values.indexOf(value));
    el.scrollTop = index * item;
    placed.current = true;
  }, [value, values]);
  return (
    <div>
      <p className="mb-1 text-center text-t12 text-[#9eb0aa]">{label}</p>
      <div className="relative overflow-hidden rounded-lg bg-[#07141a] shadow-[inset_0_0_0_1px_rgba(215,230,225,0.18)]">
        <div
          className="pointer-events-none absolute inset-y-3 left-1 z-10 flex w-1.5 flex-col justify-between"
          aria-hidden
        >
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className={`block h-px ${i === 4 ? "w-2.5 bg-[#f4fff8]" : "w-1.5 bg-[#9eb0aa]/50"}`}
            />
          ))}
        </div>
        <div
          className={`pointer-events-none absolute inset-x-0 top-1/2 z-10 h-10 -translate-y-1/2 border-y ${hair}`}
          aria-hidden
        />
        <div
          ref={scroller}
          className="h-[160px] overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] snap-y snap-mandatory mask-[linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent)] [&::-webkit-scrollbar]:hidden"
          onScroll={(e) => {
            const el = e.currentTarget;
            const index = Math.round(el.scrollTop / item);
            const next = values[Math.max(0, Math.min(values.length - 1, index))];
            if (next != null && next !== value) onChange(next);
          }}
        >
          <div style={{ height: item * 1.5 }} />
          {values.map((v) => (
            <div
              key={v}
              className={`flex h-10 snap-center items-baseline justify-center font-display font-semibold tabular-nums ${
                v === value ? `text-2xl ${picked}` : "text-lg text-[#7d9aa6]/55"
              }`}
            >
              {v.toFixed(places)}
              <span className="ml-0.5 text-t12 font-medium text-[#9eb0aa]">{unit}</span>
            </div>
          ))}
          <div style={{ height: item * 1.5 }} />
        </div>
      </div>
    </div>
  );
}

function Prompt({
  kicker,
  title,
  onCancel,
}: {
  kicker: string;
  title: string;
  onCancel: () => void;
}) {
  return (
    <div>
      <p className="text-t12 text-muted-foreground">{kicker}</p>
      <p className="mt-1 text-sm">{title}</p>
      <Row cancel="Cancel" ok="" onCancel={onCancel} onOk={() => {}} hideOk />
    </div>
  );
}

function Row({
  cancel,
  ok,
  onCancel,
  onOk,
  okDisabled,
  hideOk,
}: {
  cancel: string;
  ok: string;
  onCancel: () => void;
  onOk: () => void;
  okDisabled?: boolean;
  hideOk?: boolean;
}) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <Button variant="outline" onClick={onCancel}>
        {cancel}
      </Button>
      {hideOk ? <span /> : (
        <Button disabled={okDisabled} onClick={onOk}>
          {ok}
        </Button>
      )}
    </div>
  );
}
