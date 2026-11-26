import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMeters, haversineMeters } from "@/lib/geo";
import { forget } from "@/lib/library-cache";
import { PLACE_KINDS, PLACE_LABEL, PLACE_LIMITS, placesOn, removePlace, reportPlace, sharePlace, type PlaceKind } from "@/lib/place-library";
import { useHelm, useUnitsKey } from "@/store/helm";

const BOTTOM = "bottom-[calc(max(0.5rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))+4.4rem)]";

/** The card for a place tapped on the chart. */
export function PlaceCard() {
  useUnitsKey();
  const p = useHelm((s) => s.placeCard);
  const boat = useHelm((s) => s.boat);
  const mine = useHelm((s) => s.myPlaces);
  const panel = useHelm((s) => s.panel);
  if (!p || panel) return null;
  const close = () => useHelm.setState({ placeCard: null });
  const own = mine.find((m) => m.id === p.id);
  const tel = p.phone.replace(/[^\d+]/g, "");
  return (
    <div className={`pointer-events-none absolute inset-x-0 ${BOTTOM} z-30 flex justify-center px-2`}>
      <div className="pointer-events-auto w-full max-w-md rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-border)] rp-glass">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-t15 font-semibold">{p.name || PLACE_LABEL[p.kind]}</p>
            <p className="text-t13 text-muted-foreground">
              {[p.name ? PLACE_LABEL[p.kind] : "", own ? "yours" : "", boat ? `${formatMeters(haversineMeters(boat, p))} from you` : ""].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button variant="outline" className="h-10 shrink-0" onClick={close}>
            Close
          </Button>
        </div>
        {p.vhf ? <p className="mt-1.5 text-t15">VHF channel <b>{p.vhf}</b></p> : null}
        {p.phone ? (
          <p className="mt-0.5 text-t15">
            Phone{" "}
            <a className="font-semibold text-primary underline" href={`tel:${tel}`}>
              {p.phone}
            </a>
          </p>
        ) : null}
        {p.comment ? <p className="mt-1.5 text-t14 leading-snug">“{p.comment}”</p> : null}
        <p className="mt-1.5 text-t12 leading-snug text-muted-foreground">
          {p.source === "open"
            ? `Open data: ${p.credit ?? "government"}. Check it's still there.`
            : "Shared by a skipper and not checked. In an emergency call on VHF 16 or 000."}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {p.source === "shared" ? (
            own ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void removePlace(own.id, own.secret)
                    .then(() => {
                      useHelm.setState({ myPlaces: useHelm.getState().myPlaces.filter((m) => m.id !== own.id), placeCard: null });
                      void forget("places", own.id);
                      window.dispatchEvent(new CustomEvent("helm:place-removed", { detail: own.id }));
                      toast("Removed.");
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
                  if (!window.confirm("Report this place as wrong or gone? Three reports hide it.")) return;
                  void reportPlace(p.id)
                    .then(() => toast("Thanks, reported."))
                    .catch(() => toast.error("Couldn't send the report"));
                }}
              >
                Report
              </Button>
            )
          ) : (
            <span />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const st = useHelm.getState();
              st.setFollowBoat(false);
              st.fly(p.lat, p.lng, 17);
            }}
          >
            Zoom in here
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Add a place at the pressed spot: what it is, a name, VHF channel, phone, a note. */
export function AddPlaceCard() {
  const at = useHelm((s) => s.addPlaceAt);
  const [kind, setKind] = useState<PlaceKind>("mooring");
  const [name, setName] = useState("");
  const [vhf, setVhf] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  if (!at || !placesOn()) return null;
  const close = () => useHelm.setState({ addPlaceAt: null });
  const save = async () => {
    setBusy(true);
    try {
      const r = await sharePlace({ kind, lat: at.lat, lng: at.lng, name, comment, vhf, phone });
      const st = useHelm.getState();
      useHelm.setState({ myPlaces: [{ id: r.id, secret: r.secret, lat: at.lat, lng: at.lng }, ...st.myPlaces].slice(0, 300), addPlaceAt: null });
      window.dispatchEvent(
        new CustomEvent("helm:place-shared", {
          detail: { id: r.id, kind, lat: at.lat, lng: at.lng, name, comment, vhf, phone, createdAt: new Date().toISOString(), source: "shared" },
        }),
      );
      toast.success("Added. Other skippers will see it on the chart.");
      setName("");
      setVhf("");
      setPhone("");
      setComment("");
    } catch {
      toast.error("Couldn't add it. It needs signal: try again later.");
    } finally {
      setBusy(false);
    }
  };
  const radio = kind === "rescue" || kind === "marina";
  return (
    <div className={`pointer-events-none absolute inset-x-0 ${BOTTOM} z-40 flex justify-center px-2`}>
      <div className="pointer-events-auto max-h-[70vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-border)] rp-glass">
        <p className="text-t15 font-semibold">Add a place for other skippers</p>
        <p className="text-t13 text-muted-foreground">At the spot you pressed. Shared without your name.</p>
        <div className="mt-2 grid grid-cols-2 gap-1">
          {PLACE_KINDS.map((k) => (
            <Button key={k} size="sm" variant={kind === k ? "default" : "outline"} className="px-1" onClick={() => setKind(k)}>
              {PLACE_LABEL[k]}
            </Button>
          ))}
        </div>
        <label className="mt-2 grid gap-1">
          <span className="text-t13 text-muted-foreground">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value.slice(0, PLACE_LIMITS.name))} placeholder={kind === "rescue" ? "e.g. VMR Whitsunday" : "e.g. Nara Inlet mooring 3"} className="h-11 text-base" />
        </label>
        {radio ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              <span className="text-t13 text-muted-foreground">VHF channel</span>
              <Input value={vhf} inputMode="numeric" onChange={(e) => setVhf(e.target.value.slice(0, PLACE_LIMITS.vhf))} placeholder="e.g. 16, 81" className="h-11 text-base" />
            </label>
            <label className="grid gap-1">
              <span className="text-t13 text-muted-foreground">Phone</span>
              <Input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value.slice(0, PLACE_LIMITS.phone))} className="h-11 text-base" />
            </label>
          </div>
        ) : null}
        <label className="mt-2 grid gap-1">
          <span className="text-t13 text-muted-foreground">Note (optional)</span>
          <Input
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, PLACE_LIMITS.comment))}
            placeholder={kind === "mooring" ? "e.g. Pink buoy, max 2 h, boats under 18 m" : "e.g. Open 7am–5pm"}
            className="h-11 text-base"
          />
        </label>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Button disabled={busy} onClick={() => void save()}>
            {busy ? "Adding…" : "Add"}
          </Button>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
