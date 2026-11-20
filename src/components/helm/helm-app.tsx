import { useEffect } from "react";
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
import { useHelm } from "@/store/helm";

export function HelmApp() {
  useGpsWatch();
  useDemoCruise();
  useAnchorWatch();
  useWakeLock();
  useMarkMade();
  useAutoNight();
  useRemoteWatch();

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
  const watchOn = useHelm((s) => Boolean(s.anchor?.radiusLocked));
  const dragging = useHelm((s) => s.alarmOn);
  const gpsLost = useHelm((s) => s.gpsLost);
  const breach = dragging || gpsLost;

  return (
    <div
      className={`relative h-dvh w-full overflow-hidden bg-background text-foreground${
        look === "sunlight" ? " rp-sunlight" : look === "night" ? " rp-night" : ""
      }`}
      data-sun-punch={look === "sunlight" ? String(sunPunch) : undefined}
    >
      <MapView key="sat-v15" />
      {watchOn ? (
        <div
          className={`pointer-events-none absolute inset-0 z-40 shadow-[inset_0_0_0_3px_currentColor] ${
            breach ? "text-destructive" : "text-primary"
          }`}
          aria-hidden
        >
          <p
            className={`absolute top-[calc(max(0.4rem,env(safe-area-inset-top))+4.1rem)] left-1/2 -translate-x-1/2 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase shadow-[var(--shadow-border)] ${
              breach ? "bg-destructive text-white" : "bg-card/95 text-primary"
            }`}
          >
            {breach ? "Alarm" : "Watch on"}
          </p>
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
