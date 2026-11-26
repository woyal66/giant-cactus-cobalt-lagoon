import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "@/components/ui/button";
import { getChartBounds } from "@/components/helm/map-view";
import { ATTR_DEPTH, DEPTH_MAX_Z, registerDepthProtocol, registerTerrainProtocol } from "@/lib/depth";
import { ATTR_LAND } from "@/components/helm/land-layer";

let depthProtocol = false;
/** Seabed under water, real land heights on land (see terrainTilePng). */
const TERRAIN_TILES = "terraindem://{z}/{x}/{y}";
import { autoSatOrder, imageryShort, satTileTemplate, type SatSource } from "@/lib/imagery";
import { useHelm } from "@/store/helm";

const EXAGGERATION = [1, 2, 4, 8] as const;

function photoSource(imagery: string): SatSource | null {
  const order: SatSource[] = imagery === "auto" ? autoSatOrder(18) : [imagery as SatSource, ...autoSatOrder(18)];
  return order.find((id) => satTileTemplate(id)) ?? null;
}

/**
 * 3D reef view: the satellite photo draped over the seabed model, tilted, with the relief
 * exaggerated so channels and drop-offs stand out. For planning; it needs a connection.
 */
export function Reef3D({ onClose }: { onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // 2× shows reefs and hills together; mountains look wild at 8×, reefs flat at 1×.
  const [ex, setEx] = useState<(typeof EXAGGERATION)[number]>(2);
  const imagery = useHelm((s) => s.imagery);
  const src = photoSource(imagery);

  useEffect(() => {
    if (!box.current || !src) return;
    const view = getChartBounds();
    const boat = useHelm.getState().boat;
    const center: [number, number] = view
      ? [(view.east + view.west) / 2, (view.north + view.south) / 2]
      : boat
        ? [boat.lng, boat.lat]
        : [152.3955, -23.9045];
    if (!depthProtocol) {
      registerDepthProtocol(maplibregl as unknown as Parameters<typeof registerDepthProtocol>[0]);
      registerTerrainProtocol(maplibregl as unknown as Parameters<typeof registerTerrainProtocol>[0]);
      depthProtocol = true;
    }
    const map = new maplibregl.Map({
      container: box.current,
      // MapLibre zoom levels are one less than the chart's for the same scale.
      zoom: Math.min(16, (view?.zoom ?? 15) - 1),
      center,
      pitch: 60,
      maxPitch: 80,
      // Credits are in the bottom card, so the control doesn't cover the buttons.
      attributionControl: false,
      style: {
        version: 8,
        sources: {
          photo: { type: "raster", tiles: [satTileTemplate(src)!], tileSize: 256, maxzoom: 19, attribution: imageryShort(src) },
          dem: { type: "raster-dem", tiles: [TERRAIN_TILES], encoding: "terrarium", tileSize: 256, maxzoom: DEPTH_MAX_Z, attribution: ATTR_DEPTH },
          shade: { type: "raster-dem", tiles: [TERRAIN_TILES], encoding: "terrarium", tileSize: 256, maxzoom: DEPTH_MAX_Z },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#071318" } },
          { id: "photo", type: "raster", source: "photo" },
          { id: "relief", type: "hillshade", source: "shade", paint: { "hillshade-exaggeration": 0.35, "hillshade-shadow-color": "#001020" } },
        ],
        terrain: { source: "dem", exaggeration: 2 },
      },
    });
    mapRef.current = map;
    map.on("load", () => {
      const s = useHelm.getState();
      if (s.boat) new maplibregl.Marker({ color: "#3ee0c0" }).setLngLat([s.boat.lng, s.boat.lat]).addTo(map);
      const route = s.activePassage?.waypoints ?? [];
      if (route.length >= 2) {
        map.addSource("route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.map((w) => [w.lng, w.lat]) } },
        });
        map.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#f0c14a", "line-width": 4 } });
      }
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    // Changing the terrain before the style has loaded throws; wait for it.
    const apply = () => map.setTerrain({ source: "dem", exaggeration: ex });
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [ex]);

  return (
    <div className="pointer-events-auto absolute inset-0 z-[60] bg-background">
      {/* MapLibre makes its container position: relative, so size it with a wrapper. */}
      <div className="absolute inset-0">
        <div ref={box} className="h-full w-full" />
      </div>
      <div className="absolute inset-x-2 top-[max(0.5rem,var(--safe-area-inset-top,env(safe-area-inset-top)))] flex items-start justify-between gap-2">
        <div className="rounded-lg bg-card/95 px-2.5 py-1.5 text-t13 leading-snug shadow-[var(--shadow-border)]">
          <p className="text-t15 font-semibold">3D view: reef and land</p>
          <p className="text-muted-foreground">Drag to move · two fingers to tilt and turn</p>
        </div>
        <Button className="h-11" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="absolute inset-x-2 bottom-[max(0.75rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))] rounded-lg bg-card/95 p-2 shadow-[var(--shadow-border)]">
        <p className="mb-1 text-t13 text-muted-foreground">Height of reefs and hills (exaggerated)</p>
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Height of reefs and hills">
          {EXAGGERATION.map((v) => (
            <Button key={v} role="radio" aria-checked={ex === v} variant={ex === v ? "default" : "outline"} className="h-11" onClick={() => setEx(v)}>
              {v}×
            </Button>
          ))}
        </div>
        <p className="mt-1 text-t13 leading-snug text-muted-foreground">
          {src ? `Photo: ${imageryShort(src)}. ` : ""}Hills and headlands show where you'll find shelter. The seabed model shows
          channels and drop-offs, not bommies. For planning, not navigation.
        </p>
        <p className="mt-0.5 text-t11 text-muted-foreground">{ATTR_DEPTH} · {ATTR_LAND}</p>
      </div>
      {!src ? (
        <p className="absolute inset-x-4 top-1/2 rounded-lg bg-card p-3 text-center">No satellite source in this build can be shown in 3D.</p>
      ) : null}
    </div>
  );
}
