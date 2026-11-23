import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "sonner";
import { MapView } from "@/components/helm/map-view";
import { BottomDock } from "@/components/helm/dock";
import { NavRibbon, MobHud, TopHud } from "@/components/helm/hud";
import { WeatherPanel, WxStrip } from "@/components/helm/weather";
import {
  AlarmOverlay,
  Disclaimer,
  SteerOverlay,
} from "@/components/helm/overlays";
import {
  AnchorPanel,
  AtlasPanel,
  LayersPanel,
  LegendPanel,
  PassagesPanel,
  SavePanel,
} from "@/components/helm/panels";
import { BoatPanel } from "@/components/helm/boat-panel";
import { FirstRunGuide } from "@/components/helm/first-run-guide";
import { PassageHud } from "@/components/helm/passage-hud";
import { RadarChip } from "@/components/helm/radar-chip";
import { DepthChip } from "@/components/helm/depth-chip";
import { WxMapBar, WxProbeCard } from "@/components/helm/wx-map-bar";
import { PinCard } from "@/components/helm/pin-card";
import { PerfChip } from "@/components/helm/perf-chip";
import { WebNotice } from "@/components/helm/web-notice";
import { usePolarMonitor } from "@/hooks/polar-monitor";
import { useTideNow } from "@/hooks/tide-now";
import { useMobDrift } from "@/hooks/mob-drift";
import {
  useAnchorWatch,
  useAutoNight,
  useRemoteWatch,
  useDemoCruise,
  useGpsWatch,
  useMarkMade,
  useWakeLock,
} from "@/hooks/helm-runtime";
import { getPublicPassage } from "@/lib/passages";
import { listPacks } from "@/lib/offline-tiles";
import { useHelm, useUnitsKey } from "@/store/helm";
import { formatMeters, haversineMeters } from "@/lib/geo";

// The passage planner (and its settings, graph and window finder) loads when first opened.
// The 3D view (MapLibre, ~1 MB) only loads when opened.
const Reef3D = lazy(() => import("@/components/helm/reef-3d").then((m) => ({ default: m.Reef3D })));
const RoutePlanner = lazy(() => import("@/components/helm/route-planner").then((m) => ({ default: m.RoutePlanner })));

export function HelmApp() {
  useGpsWatch();
  useDemoCruise();
  useAnchorWatch();
  useWakeLock();
  useMarkMade();
  useAutoNight();
  useRemoteWatch();
  useMobDrift();
  usePolarMonitor();
  useTideNow();

  useEffect(() => {
    void listPacks().then((p) => useHelm.getState().setOfflinePacks(p));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("passage"));
    if (!Number.isFinite(id) || id <= 0) return;
    void getPublicPassage({ data: { id } }).then((p) => {
      if (p) {
        useHelm.getState().setActivePassage(p);
      }
    });
  }, []);

  const look = useHelm((s) => s.look);
  const sunPunch = useHelm((s) => s.sunPunch);
  const clarity = useHelm((s) => s.reefClarity);
  const chartBase = useHelm((s) => s.baseMap === "chart");
  const reef3d = useHelm((s) => s.reef3d);
  const plannerOn = useHelm((s) => s.panel === "route" || s.tapMode === "route-start" || s.tapMode === "route-finish");
  const textSize = useHelm((s) => s.textSize);
  useEffect(() => {
    document.documentElement.dataset.text = textSize;
  }, [textSize]);
  const watchOn = useHelm((s) => Boolean(s.anchor?.radiusLocked));
  const dragging = useHelm((s) => s.alarmOn);
  const gpsLost = useHelm((s) => s.gpsLost);
  const breach = dragging || gpsLost;

  return (
    <div
      className={`relative h-dvh w-full overflow-hidden bg-background text-foreground${
        look === "sunlight" ? " rp-sunlight" : look === "night" ? " rp-night" : ""
      }${clarity && look === "normal" ? " rp-clarity" : ""}${chartBase ? " rp-chart" : ""}`}
      data-sun-punch={look === "sunlight" ? String(sunPunch) : undefined}
    >
      <MapView key="sat-v15" />
      {watchOn ? (
        <div
          className={`pointer-events-none absolute inset-0 z-40 shadow-[inset_0_0_0_3px_currentColor] ${
            breach ? "text-destructive" : "text-primary"
          }`}
        >
          <WatchBadge breach={breach} gpsLost={gpsLost} />
        </div>
      ) : null}
      <TopHud />
      <MobHud />
      <SteerOverlay />
      <NavRibbon />
      <AtlasPanel />
      <PassagesPanel />
      <AnchorPanel />
      <BoatPanel />
      <LegendPanel />
      <LayersPanel />
      <SavePanel />
      <WeatherPanel />
      <WxStrip />
      <BottomDock />
      <Disclaimer />
      <RadarChip />
      {reef3d ? (
        <Suspense fallback={null}>
          <Reef3D onClose={() => useHelm.setState({ reef3d: false })} />
        </Suspense>
      ) : null}
      <DepthChip />
      <WxMapBar />
      <WxProbeCard />
      <PinCard />
      <PerfChip />
      <WebNotice />
      <PassageHud />
      {plannerOn ? (
        <Suspense fallback={null}>
          <RoutePlanner />
        </Suspense>
      ) : null}
      <AlarmOverlay />
      <FirstRunGuide />
      <Toaster
        theme="dark"
        position="bottom-center"
        offset={{ bottom: "5.4rem" }}
        toastOptions={{
          className:
            "!bg-card !text-foreground !border !border-border !font-sans",
        }}
      />
    </div>
  );
}

/**
 * Always-visible anchor watch status, so the skipper can plan, read the forecast
 * or use any other tool while the watch runs. Tap to open the anchor sheet.
 */
function WatchBadge({ breach, gpsLost }: { breach: boolean; gpsLost: boolean }) {
  const boat = useHelm((s) => s.boat);
  const anchor = useHelm((s) => s.anchor);
  useUnitsKey();
  const dist = boat && anchor ? haversineMeters(boat, anchor) : null;
  const fresh = boat ? Date.now() - boat.at < 60_000 && boat.source !== "placed" : false;
  const text = breach
    ? gpsLost
      ? "Alarm · GPS lost"
      : "Alarm · dragging"
    : dist != null && anchor
      ? `Watch on · ${formatMeters(dist)} / ${formatMeters(anchor.radiusM)}${fresh ? "" : " · no fix"}`
      : "Watch on";
  return (
    <button
      type="button"
      aria-label="Anchor watch status. Opens the anchor settings."
      onClick={() => useHelm.getState().setPanel("anchor")}
      className={`pointer-events-auto absolute top-[calc(max(0.4rem,var(--safe-area-inset-top,env(safe-area-inset-top)))+4.1rem)] left-1/2 min-h-8 -translate-x-1/2 rounded-full px-3 py-1 text-t13 font-semibold whitespace-nowrap tabular-nums shadow-[var(--shadow-border)] ${
        breach ? "bg-destructive text-white" : "bg-card/95 text-primary"
      }`}
    >
      {text}
    </button>
  );
}
