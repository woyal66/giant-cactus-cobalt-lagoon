import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getChartBounds } from "@/components/helm/map-view";
import { formatMeters } from "@/lib/geo";
import { zoomToFit } from "@/lib/place-search";
import {
  libraryConfig,
  loadLibraryPoints,
  reportLibraryTrack,
  searchLibrary,
  type LatLngPt,
  type LibraryTrack,
} from "@/lib/track-library";
import { MAX_TRACKS, useHelm, useUnitsKey, type LocalDraft } from "@/store/helm";

/** Search the online library, preview a track on the chart, save it to the phone. */
export function LibraryTab() {
  useUnitsKey();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [hits, setHits] = useState<LibraryTrack[] | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ t: LibraryTrack; pts: LatLngPt[] } | null>(null);
  const drafts = useHelm((s) => s.drafts);
  const ready = Boolean(libraryConfig());

  // Clear the preview line when the tab closes.
  useEffect(
    () => () => {
      useHelm.setState({ libraryPreview: null });
    },
    [],
  );

  const run = async (text: string) => {
    setBusy(true);
    setError("");
    try {
      const b = getChartBounds();
      const box = b ? { s: b.south, w: b.west, n: b.north, e: b.east } : null;
      setHits(await searchLibrary(text, box));
    } catch {
      setError("Couldn't reach the library. It needs signal; saved tracks work offline.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (ready) void run("");
    // Once, for the tracks in view.
  }, [ready]);

  if (!ready) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-t14 text-muted-foreground">
        The online library isn't switched on in this version yet. Your own tracks work as normal.
      </p>
    );
  }

  const show = async (t: LibraryTrack) => {
    setBusy(true);
    try {
      const pts = await loadLibraryPoints(t.id);
      if (pts.length < 2) throw new Error("empty");
      setPreview({ t, pts });
      const st = useHelm.getState();
      useHelm.setState({ libraryPreview: pts });
      st.setFollowBoat(false);
      const fit = zoomToFit(pts);
      if (fit) st.fly(fit.lat, fit.lng, fit.zoom);
    } catch {
      toast.error("Couldn't load that track");
    } finally {
      setBusy(false);
    }
  };

  const saved = (id: string) => drafts.some((d) => d.libraryId === id || d.localId === `lib-${id}`);

  const save = (t: LibraryTrack, pts: LatLngPt[]) => {
    const d: LocalDraft = {
      localId: `lib-${t.id}`,
      title: t.title,
      region: t.location,
      notes: t.comment,
      kind: "passage",
      waypoints: pts.map((p, i) => ({ ...p, label: i === 0 ? "Start" : i === pts.length - 1 ? "Stop" : `WP ${i + 1}` })),
      savedAt: new Date().toISOString(),
      tapped: true,
      fromLibrary: true,
    };
    const s = useHelm.getState();
    useHelm.setState({ drafts: [d, ...s.drafts.filter((x) => x.localId !== d.localId)].slice(0, MAX_TRACKS) });
    toast.success(`Saved "${t.title}" to My tracks. Save the map area offline too (Chart → Offline packs).`);
  };

  return (
    <div>
      <form
        className="mb-2 flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void run(q);
        }}
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search: place or comment"
          aria-label="Search the track library"
          className="h-11 text-base"
          type="search"
        />
        <Button type="submit" className="h-11" disabled={busy}>
          Search
        </Button>
      </form>
      <p className="mb-2 text-t13 leading-snug text-muted-foreground">
        Shared by other skippers and not checked by us. Look at the water yourself and treat every track as a guide only.
      </p>
      {preview ? (
        <div className="mb-2 rounded-lg border border-primary/60 px-2.5 py-2">
          <p className="text-t15 font-semibold">{preview.t.title}</p>
          <p className="text-t13 text-muted-foreground">
            {[preview.t.location, formatMeters(preview.t.lengthM)].filter(Boolean).join(" · ")}
          </p>
          {preview.t.comment ? <p className="mt-1 text-t14">{preview.t.comment}</p> : null}
          <p className="mt-1 text-t13 text-muted-foreground">Shown on the chart as a dashed line.</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Button size="sm" disabled={saved(preview.t.id)} onClick={() => save(preview.t, preview.pts)}>
              {saved(preview.t.id) ? "On this phone" : "Save to phone"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPreview(null);
                useHelm.setState({ libraryPreview: null });
              }}
            >
              Close preview
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="col-span-2"
              onClick={() => {
                if (!window.confirm("Report this track as wrong, unsafe or not a track? Three reports hide it.")) return;
                void reportLibraryTrack(preview.t.id)
                  .then(() => toast("Thanks, reported."))
                  .catch(() => toast.error("Couldn't send the report"));
              }}
            >
              Report this track
            </Button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mb-2 text-t13 text-destructive">{error}</p> : null}
      {busy && !hits ? <p className="text-t14 text-muted-foreground">Searching…</p> : null}
      {hits && !hits.length ? (
        <p className="text-t14 text-muted-foreground">
          {q.trim() ? `No shared tracks for “${q.trim()}”.` : "No shared tracks in this part of the chart yet. Search by name, or share one of yours."}
        </p>
      ) : null}
      <ul className="grid gap-1.5">
        {(hits ?? []).map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => void show(t)}
              className={`w-full rounded-md border px-2.5 py-2 text-left ${preview?.t.id === t.id ? "border-primary" : "border-border"}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-t15 font-semibold">{t.location || t.title}</p>
                <span className="shrink-0 text-t13 text-muted-foreground">{formatMeters(t.lengthM)}</span>
              </div>
              <p className="line-clamp-2 text-t13 text-muted-foreground">
                {[t.location ? t.title : "", t.comment].filter(Boolean).join(" · ") || "No comment"}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
