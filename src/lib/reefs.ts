export type ReefSpot = {
  id: string;
  name: string;
  region: string;
  country: string;
  lat: number;
  lng: number;
  zoom: number;
  blurb: string;
};

export const DEFAULT_REEF_ID = "lady-musgrave";

export const REEFS: ReefSpot[] = [
  {
    id: "lady-musgrave",
    name: "Lady Musgrave",
    region: "Great Barrier Reef",
    country: "Australia",
    lat: -23.904,
    lng: 152.395,
    zoom: 16,
    blurb:
      "A navigable coral lagoon with one north-west cut. Dark water is the channel; brown is coral. Sand patches inside for the hook.",
  },
  {
    id: "heart-reef",
    name: "Heart Reef",
    region: "Hardy Reef, Whitsundays",
    country: "Australia",
    lat: -19.742,
    lng: 149.185,
    zoom: 16,
    blurb:
      "The heart sits inside Hardy Reef. Stay in the indigo channels — the formation itself is protected and too shallow.",
  },
  {
    id: "heron-island",
    name: "Heron Island",
    region: "Capricornia Cays",
    country: "Australia",
    lat: -23.4425,
    lng: 151.9145,
    zoom: 15,
    blurb:
      "Research cay with a dredged south-west harbour. Coral gardens start the moment you leave the cut.",
  },
  {
    id: "whitehaven",
    name: "Hill Inlet",
    region: "Whitsundays",
    country: "Australia",
    lat: -20.27,
    lng: 149.018,
    zoom: 15,
    blurb:
      "Silica swirl of Hill Inlet. Drying banks shift with tide — the colour of the water is the chart.",
  },
  {
    id: "agincourt",
    name: "Agincourt Reef",
    region: "Outer GBR",
    country: "Australia",
    lat: -16.041,
    lng: 145.868,
    zoom: 15,
    blurb:
      "Ribbon of outer reef off Port Douglas. Outer wall drops to the Coral Sea; inner water threads between bommies.",
  },
  {
    id: "lizard",
    name: "Lizard Island",
    region: "Northern GBR",
    country: "Australia",
    lat: -14.668,
    lng: 145.462,
    zoom: 14,
    blurb:
      "Granite island, fringing reef. Watsons Bay is the classic sand anchorage in settled weather.",
  },
  {
    id: "coral-bay",
    name: "Coral Bay",
    region: "Ningaloo Reef",
    country: "Australia",
    lat: -23.145,
    lng: 113.768,
    zoom: 14,
    blurb:
      "Fringing reef a few hundred metres off the beach. Cardabia and Yalobia passages cut through to the Indian Ocean.",
  },
  {
    id: "turquoise-bay",
    name: "Turquoise Bay",
    region: "Ningaloo Reef",
    country: "Australia",
    lat: -22.089,
    lng: 113.89,
    zoom: 16,
    blurb:
      "Pale sand, dark coral fingers, and a north-setting drift. Read the fingers before you close the beach.",
  },
  {
    id: "rowley",
    name: "Clerke Reef",
    region: "Rowley Shoals",
    country: "Australia",
    lat: -17.31,
    lng: 119.35,
    zoom: 13,
    blurb:
      "Remote atoll 160 nm off Broome. One pass into a lagoon of sand and coral heads.",
  },
  {
    id: "bora-bora",
    name: "Teavanui Pass",
    region: "Bora Bora",
    country: "French Polynesia",
    lat: -16.494,
    lng: -151.762,
    zoom: 14,
    blurb:
      "The only pass into Bora Bora’s lagoon. Deep, well used, with coral walls that read clearly from altitude.",
  },
  {
    id: "rangiroa",
    name: "Tiputa Pass",
    region: "Rangiroa",
    country: "French Polynesia",
    lat: -14.972,
    lng: -147.623,
    zoom: 14,
    blurb:
      "A river of indigo between two pale reef flats. Incoming current is famous — time the pass.",
  },
  {
    id: "blue-hole",
    name: "Great Blue Hole",
    region: "Lighthouse Reef",
    country: "Belize",
    lat: 17.316,
    lng: -87.535,
    zoom: 15,
    blurb:
      "Circular sinkhole inside Lighthouse Reef. Approach via the atoll’s cuts, never over the rim.",
  },
  {
    id: "palau",
    name: "Rock Islands",
    region: "Palau",
    country: "Palau",
    lat: 7.246,
    lng: 134.376,
    zoom: 13,
    blurb:
      "Limestone maze. Satellite is how you pick the sand corridors between the mushroom islands.",
  },
  {
    id: "male-atoll",
    name: "North Malé Atoll",
    region: "Maldives",
    country: "Maldives",
    lat: 4.32,
    lng: 73.52,
    zoom: 12,
    blurb:
      "House reefs and a deep inner sea. Every resort channel is a pale cut in the coral.",
  },
];

import { haversineMeters } from "./geo.ts";

export function getReef(id: string): ReefSpot {
  return REEFS.find((r) => r.id === id) ?? REEFS[0]!;
}

export function nearestReef(
  lat: number,
  lng: number,
  maxM = 12_000,
): ReefSpot | null {
  let best: ReefSpot | null = null;
  let bestD = maxM;
  for (const r of REEFS) {
    const d = haversineMeters({ lat, lng }, r);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}
