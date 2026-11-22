/** Plain-language words for passage numbers: sea state, point of sail, compass points. */

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];

export function compassPoint(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]!;
}

/** WMO sea state from significant wave height, with what it feels like on a small boat. */
export function seaState(m: number): { name: string; feel: string } {
  if (m < 0.1) return { name: "Calm", feel: "flat water" };
  if (m < 0.5) return { name: "Smooth", feel: "small wavelets, comfortable" };
  if (m < 1.25) return { name: "Slight", feel: "some motion, easy going" };
  if (m < 2.5) return { name: "Moderate", feel: "a lively ride, spray on deck upwind" };
  if (m < 4) return { name: "Rough", feel: "uncomfortable; secure the boat and crew" };
  if (m < 6) return { name: "Very rough", feel: "hard going; experienced crew only" };
  return { name: "High", feel: "dangerous for small boats" };
}

/** How the wind meets the boat (true wind angle 0–180). */
export function pointOfSail(twa: number, motoring: boolean): { name: string; feel: string } {
  if (motoring) return { name: "Under engine", feel: "wind too light or too far ahead to sail well" };
  if (twa < 50) return { name: "Close-hauled", feel: "sailing as close to the wind as you can; heeled and wet" };
  if (twa < 75) return { name: "Close reach", feel: "wind forward of the beam; fast, some heel" };
  if (twa < 110) return { name: "Beam reach", feel: "wind across the boat; usually the fastest point" };
  if (twa < 150) return { name: "Broad reach", feel: "wind behind the beam; easy and comfortable" };
  return { name: "Running", feel: "wind from behind; watch for rolling and gybes" };
}

/** For a motor boat: where the wind (and usually the sea) is on the boat. */
export function motorHeading(twa: number): { name: string; feel: string } {
  if (twa < 50) return { name: "Into the wind", feel: "head sea: ease back if the boat slams" };
  if (twa < 130) return { name: "Wind on the beam", feel: "beam sea: expect some roll" };
  return { name: "Wind behind", feel: "following sea: easy, but take care in big seas" };
}

export const GLOSSARY: Array<[string, string]> = [
  ["True wind", "The wind as it blows over the water: what a forecast gives."],
  ["Apparent wind", "The wind you feel on the moving boat, and what you trim the sails to. Going upwind it is stronger and further forward; downwind it is lighter."],
  ["Angle", "Degrees off the bow: 0° is dead ahead, 90° on the beam, 180° from behind. Port is the left side, starboard the right."],
  ["Seas", "Significant wave height: the average of the bigger third of the waves. Expect some up to about twice that."],
  ["Wind over tide", "When wind and current oppose, waves get steeper and closer together."],
  ["Current", "+ means the current is pushing you along, − means it is against you."],
  ["Storms", "Chance of thunderstorms from the forecast's storm energy (CAPE): none, possible, likely or severe."],
];
