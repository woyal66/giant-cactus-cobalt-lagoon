import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWx } from "@/hooks/weather";
import {
  ANCHORAGE_LIMITS,
  BOTTOMS,
  HOLDINGS,
  POINTS,
  anchoragesOn,
  removeAnchorage,
  reportAnchorage,
  shareAnchorage,
  shelterText,
  shelteredFrom,
  type Bottom,
  type Holding,
} from "@/lib/anchorage-library";
import { formatMeters, haversineMeters } from "@/lib/geo";
import { formatDepth } from "@/lib/units";
import { windCardinal } from "@/lib/weather";
import { useHelm, useUnitsKey } from "@/store/helm";

function when(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days < 1) return "today";
  if (days < 60) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(t).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** The card for a shared anchorage tapped on the chart. */
export function AnchorageCard() {
  useUnitsKey();
  const a = useHelm((s) => s.anchorageCard);
  const boat = useHelm((s) => s.boat);
  const mine = useHelm((s) => s.mySharedAnchorages);
  const panel = useHelm((s) => s.panel);
  const wx = useWx();
  if (!a || panel) return null;
  const close = () => useHelm.setState({ anchorageCard: null });
  const own = mine.find((m) => m.id === a.id);
  const w = wx.data?.now;
  const fit = w ? (a.shelter ? shelteredFrom(a.shelter, w.dirDeg) : null) : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))+4.4rem)] z-30 flex justify-center px-2">
      <div className="pointer-events-auto w-full max-w-md rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-border)] rp-glass">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-t15 font-semibold">Shared anchorage{own ? " (yours)" : ""}</p>
            <p className="text-t13 text-muted-foreground">
              {[a.createdAt ? `Shared ${when(a.createdAt)}` : "", boat ? `${formatMeters(haversineMeters(boat, a))} from you` : ""].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button variant="outline" className="h-10 shrink-0" onClick={close}>
            Close
          </Button>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-t14">
          <div>
            <dt className="text-t12 text-muted-foreground">Depth</dt>
            <dd className="font-semibold">{a.depthM != null ? formatDepth(a.depthM) : "Not given"}</dd>
          </div>
          <div>
            <dt className="text-t12 text-muted-foreground">Bottom and holding</dt>
            <dd className="font-semibold">
              {a.bottom === "unknown" ? "Bottom not given" : a.bottom[0]!.toUpperCase() + a.bottom.slice(1)} · {a.holding}
            </dd>
          </div>
        </dl>
        <p className="mt-1 text-t14">{shelterText(a.shelter)}</p>
        {w && fit != null ? (
          <p className={`text-t13 ${fit ? "text-primary" : "text-amber-300"}`}>
            Wind now {Math.round(w.windKn)} kn {windCardinal(w.dirDeg)}: {fit ? "sheltered from it" : "not sheltered from it"}
          </p>
        ) : null}
        {a.comment ? <p className="mt-1.5 text-t14 leading-snug">“{a.comment}”</p> : null}
        <p className="mt-1.5 text-t12 leading-snug text-muted-foreground">Shared by another skipper and not checked. Look at the water and the forecast yourself.</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {own ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void removeAnchorage(own.id, own.secret)
                  .then(() => {
                    const st = useHelm.getState();
                    useHelm.setState({ mySharedAnchorages: st.mySharedAnchorages.filter((m) => m.id !== own.id), anchorageCard: null });
                    window.dispatchEvent(new CustomEvent("helm:anchorage-removed", { detail: own.id }));
                    toast("Removed from the shared anchorages.");
                  })
                  .catch(() => toast.error("Couldn't reach the library"));
              }}
            >
              Remove mine
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!window.confirm("Report this anchorage as wrong, unsafe or not an anchorage? Three reports hide it.")) return;
                void reportAnchorage(a.id)
                  .then(() => toast("Thanks, reported."))
                  .catch(() => toast.error("Couldn't send the report"));
              }}
            >
              Report
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const st = useHelm.getState();
              st.setFollowBoat(false);
              st.fly(a.lat, a.lng, 17);
            }}
          >
            Zoom in here
          </Button>
        </div>
      </div>
    </div>
  );
}

/** In the anchor sheet while anchored: share this spot with other skippers. */
export function ShareAnchorageCard() {
  useUnitsKey();
  const anchor = useHelm((s) => (s.anchor && !s.anchor.demo ? s.anchor : null));
  const depthM = useHelm((s) => s.rode.depthM);
  const mine = useHelm((s) => s.mySharedAnchorages);
  const [open, setOpen] = useState(false);
  const [bottom, setBottom] = useState<Bottom>("sand");
  const [holding, setHolding] = useState<Holding>("good");
  const [shelter, setShelter] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  if (!anchor || !anchoragesOn()) return null;
  const already = mine.some((m) => haversineMeters(m, anchor) < 60);
  if (!open) {
    return (
      <Button variant="outline" className="mb-2 w-full" disabled={already} onClick={() => setOpen(true)}>
        {already ? "You've shared this anchorage" : "Share this anchorage with other skippers"}
      </Button>
    );
  }
  const share = async () => {
    setBusy(true);
    try {
      const r = await shareAnchorage({ lat: anchor.lat, lng: anchor.lng, depthM, bottom, holding, shelter, comment });
      const st = useHelm.getState();
      useHelm.setState({ mySharedAnchorages: [{ id: r.id, secret: r.secret, lat: anchor.lat, lng: anchor.lng }, ...st.mySharedAnchorages].slice(0, 200) });
      window.dispatchEvent(
        new CustomEvent("helm:anchorage-shared", {
          detail: { id: r.id, lat: anchor.lat, lng: anchor.lng, depthM, bottom, holding, shelter, comment, createdAt: new Date().toISOString() },
        }),
      );
      toast.success("Shared. Other skippers will see it on the chart.");
      setOpen(false);
    } catch {
      toast.error("Couldn't share it. It needs signal: try again later.");
    } finally {
      setBusy(false);
    }
  };
  const chip = (on: boolean) => (on ? "default" : "outline") as "default" | "outline";
  return (
    <div className="mb-2 rounded-lg border border-border px-2.5 py-2">
      <p className="text-t14 font-semibold">Share this anchorage</p>
      <p className="text-t13 text-muted-foreground">At the hook, {formatDepth(depthM)} deep. Shared without your name.</p>
      <p className="mt-2 mb-1 text-t13 text-muted-foreground">Bottom</p>
      <div className="grid grid-cols-3 gap-1">
        {BOTTOMS.filter((b) => b !== "unknown").map((b) => (
          <Button key={b} size="sm" variant={chip(bottom === b)} className="px-1" onClick={() => setBottom(b)}>
            {b[0]!.toUpperCase() + b.slice(1)}
          </Button>
        ))}
      </div>
      <p className="mt-2 mb-1 text-t13 text-muted-foreground">Holding</p>
      <div className="grid grid-cols-3 gap-1">
        {HOLDINGS.map((h) => (
          <Button key={h} size="sm" variant={chip(holding === h)} onClick={() => setHolding(h)}>
            {h[0]!.toUpperCase() + h.slice(1)}
          </Button>
        ))}
      </div>
      <p className="mt-2 mb-1 text-t13 text-muted-foreground">Sheltered from wind from (tap all that apply)</p>
      <div className="grid grid-cols-4 gap-1">
        {POINTS.map((p, i) => {
          const on = Boolean(shelter & (1 << i));
          return (
            <Button key={p} size="sm" variant={chip(on)} aria-pressed={on} onClick={() => setShelter(shelter ^ (1 << i))}>
              {p}
            </Button>
          );
        })}
      </div>
      <label className="mt-2 grid gap-1">
        <span className="text-t13 text-muted-foreground">Comment (optional)</span>
        <Input
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, ANCHORAGE_LIMITS.comment))}
          placeholder="e.g. Good holding in sand, rolly in a NE swell"
          className="h-11 text-base"
        />
      </label>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <Button disabled={busy} onClick={() => void share()}>
          {busy ? "Sharing…" : "Share"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
