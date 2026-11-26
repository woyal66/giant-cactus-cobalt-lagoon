import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setReturnBy } from "@/hooks/rescue-reminder";
import { signalKUrl } from "@/lib/ais";
import { nearestPlace } from "@/lib/place-library";
import { cachedInView } from "@/lib/library-cache";
import { hhmm, nextAt } from "@/lib/rescue";
import { loadOpenPlaces } from "@/components/helm/places-layer";
import type { SharedPlace } from "@/lib/place-library";
import { useHelm } from "@/store/helm";

/** AIS source and the close-approach alarm. */
export function AisSettings() {
  const source = useHelm((s) => s.aisSource);
  const key = useHelm((s) => s.aisKey);
  const host = useHelm((s) => s.aisHost);
  const alarm = useHelm((s) => s.aisAlarm);
  const status = useHelm((s) => s.aisStatus);
  const count = useHelm((s) => s.aisTargets.length);
  const [keyDraft, setKeyDraft] = useState(key);
  const [hostDraft, setHostDraft] = useState(host);
  useEffect(() => setKeyDraft(key), [key]);
  useEffect(() => setHostDraft(host), [host]);
  const chip = (on: boolean) => (on ? "default" : "outline") as "default" | "outline";
  return (
    <div className="grid gap-1.5">
      <p className="text-t14 font-semibold">AIS: ships around you</p>
      <div className="grid grid-cols-3 gap-1">
        {(
          [
            ["off", "Off"],
            ["online", "Online"],
            ["signalk", "Boat Wi-Fi"],
          ] as const
        ).map(([id, label]) => (
          <Button key={id} size="sm" variant={chip(source === id)} onClick={() => useHelm.setState({ aisSource: id })}>
            {label}
          </Button>
        ))}
      </div>
      {source === "online" ? (
        <>
          <p className="text-t13 leading-snug text-muted-foreground">
            Shore stations via aisstream.io: good near ports and busy coasts, little or nothing offshore. Make a free account at aisstream.io, create an API key and paste it here. It stays on this phone.
          </p>
          <div className="flex gap-1.5">
            <Input value={keyDraft} onChange={(e) => setKeyDraft(e.target.value.trim())} placeholder="aisstream.io API key" className="h-11 text-base" autoComplete="off" />
            <Button className="h-11 shrink-0" onClick={() => useHelm.setState({ aisKey: keyDraft })}>
              Save
            </Button>
          </div>
        </>
      ) : null}
      {source === "signalk" ? (
        <>
          <p className="text-t13 leading-snug text-muted-foreground">
            Your boat's own AIS receiver, through a Signal K server on the boat's Wi-Fi (a Raspberry Pi, Victron Cerbo GX and others). Works offshore with no internet.
          </p>
          <div className="flex gap-1.5">
            <Input value={hostDraft} onChange={(e) => setHostDraft(e.target.value)} placeholder="e.g. 192.168.1.10 or venus.local" className="h-11 text-base" autoComplete="off" />
            <Button
              className="h-11 shrink-0"
              onClick={() => {
                if (!signalKUrl(hostDraft)) return toast.error("That doesn't look like an address.");
                useHelm.setState({ aisHost: hostDraft.trim() });
              }}
            >
              Save
            </Button>
          </div>
        </>
      ) : null}
      {source !== "off" ? (
        <>
          <p className={`text-t13 ${status.state === "error" ? "text-amber-300" : "text-muted-foreground"}`}>
            {status.state === "live" ? `Connected: ${count} target${count === 1 ? "" : "s"}. ` : status.state === "connecting" ? "Connecting… " : ""}
            {status.note ?? ""}
          </p>
          <label className="flex min-h-11 items-center justify-between gap-2 text-t14">
            <span>Close-approach alarm</span>
            <input type="checkbox" className="size-6 accent-[var(--color-primary)]" checked={alarm.on} onChange={(e) => useHelm.setState({ aisAlarm: { ...alarm, on: e.target.checked } })} />
          </label>
          {alarm.on ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-t13 text-muted-foreground">
                Closer than (nm)
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0.1}
                  max={5}
                  step={0.1}
                  value={alarm.cpaNm}
                  onChange={(e) => useHelm.setState({ aisAlarm: { ...alarm, cpaNm: Math.min(5, Math.max(0.1, Number(e.target.value) || 0.5)) } })}
                  className="h-11 text-base"
                />
              </label>
              <label className="grid gap-1 text-t13 text-muted-foreground">
                Within (minutes)
                <Input
                  type="number"
                  inputMode="numeric"
                  min={3}
                  max={60}
                  value={alarm.tcpaMin}
                  onChange={(e) => useHelm.setState({ aisAlarm: { ...alarm, tcpaMin: Math.min(60, Math.max(3, Number(e.target.value) || 15)) } })}
                  className="h-11 text-base"
                />
              </label>
            </div>
          ) : null}
          <p className="text-t12 leading-snug text-muted-foreground">
            An aid, not a lookout: many small boats have no AIS. On iPhone it pauses when the app is in the background.
          </p>
        </>
      ) : null}
    </div>
  );
}

/** Marine rescue base and the log on / log off reminders. */
export function RescueSettings() {
  const r = useHelm((s) => s.rescue);
  const boat = useHelm((s) => s.boat);
  const trip = useHelm((s) => s.activeTrip);
  const set = (p: Partial<typeof r>) => useHelm.setState({ rescue: { ...useHelm.getState().rescue, ...p } });
  const [back, setBack] = useState(r.returnBy ? hhmm(r.returnBy) : "");
  useEffect(() => setBack(r.returnBy ? hhmm(r.returnBy) : ""), [r.returnBy]);
  const pickNearest = async () => {
    const at = boat ?? useHelm.getState().flyTo;
    if (!at) return toast.error("No position yet.");
    const box = { s: at.lat - 1, w: at.lng - 1, n: at.lat + 1, e: at.lng + 1 };
    const list: SharedPlace[] = [...(await loadOpenPlaces()), ...(await cachedInView<SharedPlace>("places", box))];
    const p = nearestPlace(list, "rescue", at);
    if (!p) return toast("No marine rescue base on the chart near you yet. Type yours in, or add it as a place.");
    set({ name: p.name, vhf: p.vhf, phone: p.phone });
    toast.success(`Using ${p.name || "the nearest base"}.`);
  };
  return (
    <div className="mt-3 grid gap-1.5">
      <p className="text-t14 font-semibold">Marine rescue log on / log off</p>
      <label className="flex min-h-11 items-center justify-between gap-2 text-t14">
        <span>Remind me when a trip starts and ends</span>
        <input type="checkbox" className="size-6 accent-[var(--color-primary)]" checked={r.on} onChange={(e) => set({ on: e.target.checked })} />
      </label>
      <Input value={r.name} onChange={(e) => set({ name: e.target.value.slice(0, 60) })} placeholder="Your base, e.g. VMR Whitsunday" className="h-11 text-base" />
      <div className="grid grid-cols-2 gap-2">
        <Input value={r.vhf} inputMode="numeric" onChange={(e) => set({ vhf: e.target.value.slice(0, 20) })} placeholder="VHF channel" className="h-11 text-base" />
        <Input value={r.phone} inputMode="tel" onChange={(e) => set({ phone: e.target.value.slice(0, 24) })} placeholder="Phone" className="h-11 text-base" />
      </div>
      <Button variant="outline" className="h-11" onClick={() => void pickNearest()}>
        Use the nearest marine rescue base on the chart
      </Button>
      <div className="flex items-end gap-1.5">
        <label className="grid flex-1 gap-1 text-t13 text-muted-foreground">
          Due back (reminder to log off)
          <Input type="time" value={back} onChange={(e) => setBack(e.target.value)} className="h-11 text-base" />
        </label>
        <Button
          className="h-11 shrink-0"
          onClick={() => {
            const at = nextAt(back);
            setReturnBy(at);
            toast(at ? `Reminder set for ${new Date(at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}.` : "Reminder cleared.");
          }}
        >
          Set
        </Button>
        {r.returnBy ? (
          <Button variant="ghost" className="h-11 shrink-0" onClick={() => setReturnBy(null)}>
            Clear
          </Button>
        ) : null}
      </div>
      <p className="text-t12 leading-snug text-muted-foreground">
        {trip ? "A trip is running. " : ""}The app only reminds you: it doesn't contact marine rescue. In an emergency call on VHF 16 or 000.
      </p>
    </div>
  );
}
