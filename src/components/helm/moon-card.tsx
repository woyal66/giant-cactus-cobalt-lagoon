import { useEffect, useState } from "react";
import { moonInfo, moonNote, type MoonInfo } from "@/lib/moon";
import { useHelm } from "@/store/helm";

function clock(at: number | null): string {
  if (!at) return "—";
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return today ? t : `${d.toLocaleDateString([], { weekday: "short" })} ${t}`;
}

/** Moon disc lit as it looks from the boat: a waxing moon is lit on the left in the southern hemisphere. */
function MoonGlyph({ m, south, size = 36 }: { m: MoonInfo; south: boolean; size?: number }) {
  const r = 16;
  // Terminator ellipse: x-radius goes r → 0 → r as the lit fraction goes 0 → 0.5 → 1.
  const k = Math.abs(1 - 2 * m.illumination) * r;
  const litRight = m.waxing !== south;
  const bigLit = m.illumination > 0.5;
  const sweepOuter = litRight ? 1 : 0;
  const sweepInner = bigLit === litRight ? 1 : 0;
  const d = `M 18 2 A ${r} ${r} 0 0 ${sweepOuter} 18 34 A ${k} ${r} 0 0 ${sweepInner} 18 2 Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r={r} className="fill-muted stroke-border" strokeWidth="1" />
      <path d={d} className="fill-foreground/90" />
    </svg>
  );
}

function useMoon(): (MoonInfo & { south: boolean }) | null {
  const loc = useHelm((s) => s.wxPin ?? s.anchor ?? s.boat ?? s.lastFix ?? s.flyTo);
  const lat = loc?.lat;
  const lng = loc?.lng;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 5 * 60_000);
    return () => window.clearInterval(id);
  }, []);
  if (lat == null || lng == null) return null;
  void tick;
  return { ...moonInfo(lat, lng), south: lat < 0 };
}

export function MoonCard({ compact }: { compact?: boolean }) {
  const m = useMoon();
  if (!m) return null;
  const pct = Math.round(m.illumination * 100);
  return (
    <div className="mb-2 flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
      <MoonGlyph m={m} south={m.south} size={compact ? 30 : 38} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-base leading-none font-semibold">
          {m.phaseName} <span className="text-sm font-medium text-muted-foreground">· {pct}% lit</span>
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground tabular-nums">
          Rise {clock(m.nextRise)} · Set {clock(m.nextSet)}
          {m.upNow ? " · up now" : ""}
        </p>
        {compact ? null : <p className="mt-0.5 text-[11px] text-muted-foreground">{moonNote(m)}</p>}
      </div>
    </div>
  );
}
