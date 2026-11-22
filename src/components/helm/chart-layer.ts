import type { Layer, Map as LeafletMap } from "leaflet";
import type { ChartMode } from "@/lib/chart-style";

type LeafletNS = typeof import("leaflet");

/**
 * The vector "Chart" base map (or chart lines over the photo), drawn by MapLibre inside the
 * Leaflet chart. Loaded on demand. The canvas is centred on the map centre and padded, so it
 * still fills the screen when the chart is rotated heading-up.
 */
export async function createChartLayer(L: LeafletNS, mode: ChartMode, night: boolean): Promise<Layer> {
  const [bridge, { chartStyle }, maplibre, { registerChartCache }] = await Promise.all([
    import("@maplibre/maplibre-gl-leaflet"),
    import("@/lib/chart-style"),
    import("maplibre-gl"),
    import("@/lib/chart-cache"),
  ]);
  const ml = ((maplibre as unknown as { default?: unknown }).default ?? maplibre) as Parameters<typeof registerChartCache>[0];
  registerChartCache(ml);
  const Base = (bridge as unknown as { MaplibreGL: { extend: (p: object) => new (o: object) => Layer } }).MaplibreGL;
  const Centred = Base.extend({
    _update(this: {
      _map: LeafletMap | null;
      _offset: unknown;
      _zooming: boolean;
      _container: HTMLElement;
      _glMap: unknown;
      options: { padding: number };
      _roundPoint: (p: unknown) => import("leaflet").Point;
      _transformGL: (gl: unknown) => void;
    }) {
      if (!this._map) return;
      this._offset = this._map.containerPointToLayerPoint([0, 0]);
      if (this._zooming) return;
      const size = this._map.getSize().multiplyBy(1 + this.options.padding * 2);
      const centre = this._map.latLngToLayerPoint(this._map.getCenter());
      L.DomUtil.setPosition(this._container, this._roundPoint(centre.subtract(size.divideBy(2))));
      this._transformGL(this._glMap);
    },
  });
  return new Centred({
    style: chartStyle(mode, night),
    // Enough to cover a phone screen's corners at any heading.
    padding: 0.75,
    pane: mode === "lines" ? "satHi" : "tilePane",
    interactive: false,
    attributionControl: false,
    pixelRatio: Math.min(1.5, window.devicePixelRatio || 1),
  });
}
