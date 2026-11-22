/**
 * Official charts that are free to show, drawn as an overlay where they exist. Each source is
 * a hydrographic office's own chart service, so the chart is theirs, kept up to date by them.
 *
 * - USA: NOAA Office of Coast Survey ENC display service (public domain; NOAA ENC® rendered with
 *   standard chart symbols, updated weekly). Covers the US coast, Alaska, Hawaii, Puerto Rico and
 *   the US Pacific islands.
 *
 * Add a country by adding a source here (see docs on free chart sources). Not for navigation.
 */
export type OfficialChart = {
  id: string;
  name: string;
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
];

/** Charts covering any part of a view. */
export function chartsInView(west: number, south: number, east: number, north: number): OfficialChart[] {
  return OFFICIAL_CHARTS.filter((c) => c.boxes.some(([w, s, e, n]) => w < east && e > west && s < north && n > south));
}
