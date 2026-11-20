import { useState } from "react";
import { Button } from "@/components/ui/button";
import { decodeSat, type SatForecast } from "@/lib/sat-forecast";
import { windCardinal } from "@/lib/weather";
import { RISK_LABEL } from "@/lib/routing/storm";
import { formatDepth } from "@/lib/units";

/** Paste a text forecast received by satellite messenger and read it as a table. */
export function SatPaste() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [f, setF] = useState<SatForecast | null>(null);
  const [err, setErr] = useState(false);
  if (!open) {
    return (
      <Button size="sm" variant="ghost" className="mt-1.5 w-full" onClick={() => setOpen(true)}>
        Paste satellite forecast
      </Button>
    );
  }
  const t = (ms: number) => new Date(ms).toLocaleString([], { weekday: "short", hour: "numeric" });
  return (
    <div className="mt-2 rounded-md border border-border p-2">
      <p className="mb-1 text-t13 text-muted-foreground">
        Paste the reply from your satellite messenger (lines starting “AM1”). Several messages can go in together.
      </p>
      <textarea
        aria-label="Satellite forecast text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="w-full rounded border border-border bg-background p-1.5 font-mono text-t13"
      />
      <div className="mt-1 grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          onClick={() => {
            const d = decodeSat(text);
            setF(d);
            setErr(!d);
          }}
        >
          Read it
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      {err ? <p className="mt-1 text-t14 text-amber-300">Couldn&apos;t read that. Check it starts with “AM1”.</p> : null}
      {f
        ? f.points.map((p) => (
            <div key={`${p.lat},${p.lng}`} className="mt-2">
              <p className="text-t12 text-muted-foreground tabular-nums">
                {p.lat.toFixed(2)}, {p.lng.toFixed(2)}
              </p>
              <ul className="grid gap-0.5 text-t14 tabular-nums">
                {p.steps.map((s) => (
                  <li key={s.at}>
                    {t(s.at)}: {windCardinal(s.windDir)} {s.windKn} kn{s.gustKn != null ? ` (G${s.gustKn})` : ""}
                    {s.seaM != null ? ` · sea ${formatDepth(s.seaM)}${s.periodS ? `/${s.periodS}s` : ""}` : ""}
                    {s.currentKn != null ? ` · current ${s.currentKn > 0 ? "+" : ""}${s.currentKn} kn` : ""}
                    {s.risk ? <span className="text-amber-300"> · storms {RISK_LABEL[s.risk as 0 | 1 | 2 | 3]}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))
        : null}
    </div>
  );
}
