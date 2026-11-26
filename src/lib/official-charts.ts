/**
 * Official charts that are free to show, drawn as an overlay where they exist. Each source is
 * a hydrographic office's own chart service, so the chart is theirs, kept up to date by them.
 *
 * - USA: NOAA Office of Coast Survey ENC display service (public domain; NOAA ENC® rendered with
 *   standard chart symbols, updated weekly). Covers the US coast, Alaska, Hawaii, Puerto Rico and
 *   the US Pacific islands.
 *
 * - Australia, PNG, Solomon Islands: the Australian Hydrographic Office's AHO ENC Series, a
 *   display of the official AusENC charts the AHO offers for web apps (ArcGIS ImageServer,
 *   drawn with exportImage). Not certified for navigation. Confirm the AHO's terms of use before
 *   a store release; `VITE_AHO_CHARTS=off` hides it.
 *
 * Add a country by adding a source here (see docs on free chart sources). Not for navigation.
 */
const ENV = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {}) as Record<string, string | undefined>;
export type OfficialChart = {
  id: string;
  name: string;
  /** "wms" (default) or an ArcGIS ImageServer drawn tile by tile with exportImage. */
  kind?: "wms" | "arcgis-image";
  /** WMS base URL and layers. */
  url: string;
  layers: string;
  version: "1.1.1" | "1.3.0";
  attribution: string;
  /** Areas covered, [west, south, east, north] (west > east crosses 180°). */
  boxes: Array<[number, number, number, number]>;
  minZoom: number;
};

export const OFFICIAL_CHARTS: OfficialChart[] = [
  {
    id: "noaa",
    name: "NOAA (USA)",
    url: "https://gis.charttools.noaa.gov/arcgis/rest/services/MCS/NOAAChartDisplay/MapServer/exts/MaritimeChartService/WMSServer",
    layers: "0,1,2,3,4,5,6,7,8,9,10,11,12",
    version: "1.3.0",
    attribution: "Chart: NOAA Office of Coast Survey (public domain). Not for navigation.",
    boxes: [
      [-125.5, 24, -66.5, 49.5], // contiguous US
      [-98, 17.5, -64, 31], // Gulf of Mexico, Florida, Puerto Rico, US Virgin Islands
      [-180, 50.5, -129, 72], // Alaska (east of 180°)
      [167, 50.5, 180, 56], // Aleutians west of 180°
      [-161, 18.5, -154, 23], // Hawaii
      [144, 12.5, 146.5, 21], // Guam, Northern Marianas
      [-171.5, -15, -168, -11], // American Samoa
    ],
    minZoom: 8,
  },
  ...(ENV.VITE_AHO_CHARTS === "off"
    ? []
    : [
        {
          id: "aho",
          name: "AHO (Australia)",
          kind: "arcgis-image" as const,
          url: "https://services.hydro.gov.au/site1/rest/services/Basemaps/AHOENCSeries/ImageServer",
          layers: "",
          version: "1.3.0" as const,
          attribution: "Chart: Australian Hydrographic Office, AHO ENC Series. Not for navigation.",
          boxes: [
            [112, -44.5, 154.5, -9] as [number, number, number, number], // Australia
            [140.5, -12.5, 162.5, 0] as [number, number, number, number], // Papua New Guinea, Solomon Islands
            [158.5, -32, 168.5, -28.5] as [number, number, number, number], // Lord Howe, Norfolk
          ],
          minZoom: 6,
        },
      ]),
];

/** exportImage URL for one 256 px web-mercator tile of an ArcGIS ImageServer. */
export function arcgisTileUrl(base: string, z: number, x: number, y: number): string {
  const R = 20037508.342789244;
  const size = (2 * R) / 2 ** z;
  const minx = -R + x * size;
  const maxy = R - y * size;
  const bbox = [minx, maxy - size, minx + size, maxy].map((v) => v.toFixed(2)).join(",");
  return `${base}/exportImage?bbox=${bbox}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&f=image`;
}

/** Charts covering any part of a view. */
export function chartsInView(west: number, south: number, east: number, north: number): OfficialChart[] {
  return OFFICIAL_CHARTS.filter((c) => c.boxes.some(([w, s, e, n]) => w < east && e > west && s < north && n > south));
}
