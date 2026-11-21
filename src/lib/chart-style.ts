/**
 * The "Chart" base map: a MapLibre style over OpenStreetMap vector tiles in the OpenMapTiles
 * schema. Default tiles: OpenFreeMap (free, no key; check its terms before relying on it, see
 * STORE-RELEASE). Point VITE_CHART_TILES at your own TileJSON (for example a self-hosted
 * Protomaps/OpenMapTiles extract) and VITE_CHART_GLYPHS at its font server to change it.
 *
 * Modes: "chart" draws land and sea in nautical colours; "lines" draws only coastlines and
 * names, to lay over the satellite photo. "night" darkens the chart for night vision.
 */
import type { StyleSpecification, LayerSpecification } from "maplibre-gl";

const ENV = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;

export const CHART_TILES = ENV.VITE_CHART_TILES || "https://tiles.openfreemap.org/planet";
export const CHART_GLYPHS = ENV.VITE_CHART_GLYPHS || "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const ATTR_CHART = "© OpenStreetMap contributors · OpenFreeMap";
const FONT = ["Noto Sans Regular"];
const FONT_BOLD = ["Noto Sans Bold"];

type Palette = { sea: string; land: string; green: string; town: string; coast: string; label: string; halo: string; water: string };

const DAY: Palette = {
  sea: "#a9d4ea",
  land: "#f3e7c8",
  green: "#d9e6bf",
  town: "#eadcc0",
  coast: "#4b7f99",
  label: "#1d2b33",
  halo: "#ffffff",
  water: "#1f5f86",
};
const NIGHT: Palette = {
  sea: "#08141c",
  land: "#241a12",
  green: "#22200f",
  town: "#2b1f14",
  coast: "#a0522d",
  label: "#ff9a5a",
  halo: "#000000",
  water: "#c0703a",
};

export type ChartMode = "chart" | "lines";

export function chartStyle(mode: ChartMode, night = false): StyleSpecification {
  const c = night ? NIGHT : DAY;
  const lines = mode === "lines";
  const layers: LayerSpecification[] = [];
  if (!lines) {
    // Land is the background; the water polygons (ocean included) paint the sea over it.
    layers.push(
      { id: "land", type: "background", paint: { "background-color": c.land } },
      {
        id: "landcover",
        type: "fill",
        source: "omt",
        "source-layer": "landcover",
        paint: { "fill-color": c.green, "fill-opacity": 0.6 },
      },
      {
        id: "landuse",
        type: "fill",
        source: "omt",
        "source-layer": "landuse",
        filter: ["in", ["get", "class"], ["literal", ["residential", "commercial", "industrial"]]],
        paint: { "fill-color": c.town },
      },
      { id: "sea", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": c.sea } },
    );
  }
  layers.push(
    {
      id: "coast",
      type: "line",
      source: "omt",
      "source-layer": "water",
      paint: {
        "line-color": lines ? "#ffffff" : c.coast,
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 14, 1.6],
        "line-opacity": lines ? 0.9 : 1,
      },
    },
    {
      id: "roads",
      type: "line",
      source: "omt",
      "source-layer": "transportation",
      minzoom: 11,
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary", "tertiary"]]],
      paint: { "line-color": lines ? "rgba(255,255,255,0.5)" : "#c9b48f", "line-width": 1 },
    },
    {
      id: "water-names",
      type: "symbol",
      source: "omt",
      "source-layer": "water_name",
      layout: { "text-field": ["get", "name"], "text-font": FONT, "text-size": 13, "text-letter-spacing": 0.05 },
      paint: { "text-color": lines ? "#e8f7ff" : c.water, "text-halo-color": lines ? "#00151f" : c.halo, "text-halo-width": 1.4 },
    },
    {
      id: "places",
      type: "symbol",
      source: "omt",
      "source-layer": "place",
      filter: ["in", ["get", "class"], ["literal", ["city", "town", "village", "hamlet", "island", "islet", "suburb"]]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["match", ["get", "class"], ["city", "town"], ["literal", FONT_BOLD], ["literal", FONT]],
        "text-size": ["match", ["get", "class"], "city", 16, "town", 15, 13],
      },
      paint: { "text-color": lines ? "#ffffff" : c.label, "text-halo-color": lines ? "#000000" : c.halo, "text-halo-width": 1.6 },
    },
  );
  return {
    version: 8,
    glyphs: CHART_GLYPHS,
    sources: { omt: { type: "vector", url: CHART_TILES, attribution: ATTR_CHART } },
    layers,
  };
}
