import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn, s as __exportAll } from "./ssr.mjs";
import { n as hoursFromTurns } from "./tides-VTljZa2R.mjs";
import { gn as object, yn as string } from "../_libs/@better-auth/core+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tide-station-CdgGseon.js
var EARTH_M = 6371e3;
var DEG = Math.PI / 180;
function haversineMeters(a, b) {
	const dLat = (b.lat - a.lat) * DEG;
	const dLng = (b.lng - a.lng) * DEG;
	const s1 = Math.sin(dLat / 2);
	const s2 = Math.sin(dLng / 2);
	const h = s1 * s1 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * s2 * s2;
	return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
function bearingDegrees(a, b) {
	const y = Math.sin((b.lng - a.lng) * DEG) * Math.cos(b.lat * DEG);
	const x = Math.cos(a.lat * DEG) * Math.sin(b.lat * DEG) - Math.sin(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.cos((b.lng - a.lng) * DEG);
	return (Math.atan2(y, x) / DEG + 360) % 360;
}
function destPoint(start, bearingDeg, distM) {
	const br = bearingDeg * DEG;
	const ang = distM / EARTH_M;
	const lat1 = start.lat * DEG;
	const lng1 = start.lng * DEG;
	const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(br));
	const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(ang) * Math.cos(lat1), Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2));
	return {
		lat: lat2 / DEG,
		lng: (lng2 / DEG + 540) % 360 - 180
	};
}
function pathLengthMeters(points) {
	let n = 0;
	for (let i = 1; i < points.length; i += 1) n += haversineMeters(points[i - 1], points[i]);
	return n;
}
/** Cross-track error in metres (positive = starboard of the route). */
function crossTrackMeters(p, a, b) {
	const d13 = haversineMeters(a, p) / EARTH_M;
	const t13 = bearingDegrees(a, p) * DEG;
	const t12 = bearingDegrees(a, b) * DEG;
	return Math.asin(Math.sin(d13) * Math.sin(t13 - t12)) * EARTH_M;
}
function closestOnSegment(p, a, b) {
	const len = haversineMeters(a, b);
	if (len < 1) return {
		point: a,
		t: 0,
		distM: haversineMeters(p, a)
	};
	const t = Math.max(0, Math.min(1, ((p.lat - a.lat) * (b.lat - a.lat) + (p.lng - a.lng) * (b.lng - a.lng)) / ((b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2)));
	const point = destPoint(a, bearingDegrees(a, b), t * len);
	return {
		point,
		t,
		distM: haversineMeters(p, point)
	};
}
function formatLat(lat) {
	const hemi = lat >= 0 ? "N" : "S";
	return `${toDm(Math.abs(lat))} ${hemi}`;
}
function formatLng(lng) {
	const hemi = lng >= 0 ? "E" : "W";
	return `${toDm(Math.abs(lng))} ${hemi}`;
}
function toDm(deg) {
	const d = Math.floor(deg);
	return `${d}° ${((deg - d) * 60).toFixed(3).padStart(6, "0")}'`;
}
function formatMeters(m) {
	if (!Number.isFinite(m)) return "—";
	if (Math.abs(m) >= 1852) return `${(m / 1852).toFixed(2)} nm`;
	if (Math.abs(m) >= 1e3) return `${(m / 1e3).toFixed(2)} km`;
	return `${Math.round(m)} m`;
}
/** Web-Mercator ground sample distance. */
function metersPerPixel(lat, zoom) {
	return 156543.03392 * Math.cos(lat * DEG) / 2 ** zoom;
}
function formatGroundScale(lat, zoom) {
	const m = metersPerPixel(lat, zoom);
	if (!Number.isFinite(m) || m <= 0) return "—";
	if (m >= 10) return `${Math.round(m)} m/px`;
	if (m >= 1) return `${m.toFixed(1)} m/px`;
	return `${Math.round(m * 100)} cm/px`;
}
function msToKnots(ms) {
	return ms * 1.94384;
}
function formatHeading(deg) {
	if (deg == null || !Number.isFinite(deg)) return "—";
	return `${Math.round((deg + 360) % 360).toString().padStart(3, "0")}°`;
}
function isChartUp(v) {
	return v === "north" || v === "heading";
}
function wrapDegrees(deg) {
	return (deg % 360 + 360) % 360;
}
/** Shortest signed turn from `from` to `to`, in (-180, 180]. */
function turnDegrees(from, to) {
	return (to - from + 540) % 360 - 180;
}
function lerpBearing(from, to, alpha) {
	const a = Math.min(1, Math.max(0, alpha));
	return wrapDegrees(from + turnDegrees(from, to) * a);
}
/** Map rotation: heading at the top of the screen, or north-up. */
function chartBearing(chartUp, heading) {
	if (chartUp !== "heading" || heading == null || !Number.isFinite(heading)) return 0;
	return wrapDegrees(heading);
}
/** Hull icon rotation on a screen-locked marker. Heading-up stays bow-up. */
function hullScreenHeading(chartUp, heading) {
	if (chartUp === "heading") return 0;
	if (heading == null || !Number.isFinite(heading)) return 0;
	return wrapDegrees(heading);
}
/** Ray-cast. Ring may be open or closed. */
function pointInPolygon(p, ring) {
	if (ring.length < 3) return false;
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const a = ring[i];
		const b = ring[j];
		if (!(a.lat > p.lat !== b.lat > p.lat)) continue;
		const atX = (b.lng - a.lng) * (p.lat - a.lat) / (b.lat - a.lat) + a.lng;
		if (p.lng < atX) inside = !inside;
	}
	return inside;
}
var CRUMB_MAX = 2500;
function appendTrail(trail, p, stepM = 8, max = CRUMB_MAX) {
	const last = trail[trail.length - 1];
	if (last && haversineMeters(last, p) < stepM) return trail;
	const next = [...trail, {
		lat: p.lat,
		lng: p.lng
	}];
	return next.length > max ? next.slice(-max) : next;
}
function thinTrail(pts, stepM = 20) {
	if (pts.length < 2) return pts.map((p) => ({
		lat: p.lat,
		lng: p.lng
	}));
	const out = [{
		lat: pts[0].lat,
		lng: pts[0].lng
	}];
	for (let i = 1; i < pts.length; i++) {
		const p = pts[i];
		const last = out[out.length - 1];
		if (haversineMeters(last, p) >= stepM) out.push({
			lat: p.lat,
			lng: p.lng
		});
	}
	const end = pts[pts.length - 1];
	const tail = out[out.length - 1];
	if (haversineMeters(tail, end) > 1) out.push({
		lat: end.lat,
		lng: end.lng
	});
	return out;
}
function reverseWaypoints(pts) {
	const rev = [...thinTrail(pts, 20)].reverse();
	return rev.map((w, i) => ({
		lat: w.lat,
		lng: w.lng,
		label: i === 0 ? "Turn" : i === rev.length - 1 ? "Out" : void 0
	}));
}
/** BOM National Tidal Unit standard and GBR secondary ports. Heights are LAT. */
var BOM_PORTS = [
	{
		name: "Abbot Point",
		aac: "QLD_TP001",
		lat: -19.8583,
		lng: 148.1167,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Albany",
		aac: "WA_TP001",
		lat: -35.0337,
		lng: 117.8926,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Amrun (Boyd Point)",
		aac: "QLD_TP046",
		lat: -12.9222,
		lng: 141.626,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Barrow Island (Tanker Mooring)",
		aac: "WA_TP002",
		lat: -20.8167,
		lng: 115.55,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Barrow Island (Wapet Landing)",
		aac: "WA_TP003",
		lat: -20.7333,
		lng: 115.4667,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Booby Island",
		aac: "QLD_TP026",
		lat: -10.6026,
		lng: 141.9101,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Bowen",
		aac: "QLD_TP002",
		lat: -20.025,
		lng: 148.25,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Bremer Bay",
		aac: "WA_TP086",
		lat: -34.4248,
		lng: 119.3987,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Brisbane Bar",
		aac: "QLD_TP003",
		lat: -27.3608,
		lng: 153.1719,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Broome",
		aac: "WA_TP004",
		lat: -18.0008,
		lng: 122.2186,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Bugatti Reef",
		aac: "QLD_TP004",
		lat: -20.0833,
		lng: 150.3,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Bunbury",
		aac: "WA_TP005",
		lat: -33.3234,
		lng: 115.66,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Bundaberg (Burnett Heads)",
		aac: "QLD_TP005",
		lat: -24.7667,
		lng: 152.3833,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Burnie",
		aac: "TAS_TP001",
		lat: -41.0528,
		lng: 145.9111,
		tz: "Australia/Hobart",
		primary: true
	},
	{
		name: "Cairns",
		aac: "QLD_TP006",
		lat: -16.9267,
		lng: 145.78,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Cape Domett",
		aac: "WA_TP032",
		lat: -14.8333,
		lng: 128.3,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Cape Voltaire (Krait Bay)",
		aac: "WA_TP007",
		lat: -14.25,
		lng: 125.6,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Cardwell",
		aac: "QLD_TP135",
		lat: -18.25,
		lng: 146.0333,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Carnarvon",
		aac: "WA_TP008",
		lat: -24.8987,
		lng: 113.651,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Cooktown",
		aac: "QLD_TP054",
		lat: -15.4667,
		lng: 145.25,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Coral Bay",
		aac: "WA_TP105",
		lat: -23.15,
		lng: 113.7667,
		tz: "Australia/Perth",
		primary: false
	},
	{
		name: "Dampier (King Bay)",
		aac: "WA_TP011",
		lat: -20.6236,
		lng: 116.7491,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Darwin",
		aac: "NT_TP001",
		lat: -12.4718,
		lng: 130.8459,
		tz: "Australia/Darwin",
		primary: true
	},
	{
		name: "Denham",
		aac: "WA_TP012",
		lat: -25.9333,
		lng: 113.5333,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Derby",
		aac: "WA_TP043",
		lat: -17.2923,
		lng: 123.6067,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Devonport",
		aac: "TAS_TP005",
		lat: -41.15,
		lng: 146.3833,
		tz: "Australia/Hobart",
		primary: true
	},
	{
		name: "East Hope Island",
		aac: "QLD_TP211",
		lat: -15.7333,
		lng: 145.45,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Eden",
		aac: "NSW_TP002",
		lat: -37.0712,
		lng: 149.9083,
		tz: "Australia/Sydney",
		primary: true
	},
	{
		name: "Elliott Heads",
		aac: "QLD_TP154",
		lat: -24.9167,
		lng: 152.4833,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Esperance",
		aac: "WA_TP013",
		lat: -33.8709,
		lng: 121.8954,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Exmouth",
		aac: "WA_TP014",
		lat: -21.9549,
		lng: 114.1409,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Fitzroy Island",
		aac: "QLD_TP068",
		lat: -16.9167,
		lng: 146,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Fremantle",
		aac: "WA_TP015",
		lat: -32.0558,
		lng: 115.7395,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Geelong",
		aac: "VIC_TP005",
		lat: -38.1467,
		lng: 144.3633,
		tz: "Australia/Melbourne",
		primary: true
	},
	{
		name: "Geraldton",
		aac: "WA_TP016",
		lat: -28.776,
		lng: 114.6019,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Gladstone",
		aac: "QLD_TP008",
		lat: -23.8333,
		lng: 151.25,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Gold Coast Seaway",
		aac: "QLD_TP011",
		lat: -27.95,
		lng: 153.4167,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Goods Island",
		aac: "QLD_TP027",
		lat: -10.5639,
		lng: 142.1486,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Green Island",
		aac: "QLD_TP073",
		lat: -16.76,
		lng: 145.97,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Hay Point",
		aac: "QLD_TP012",
		lat: -21.2683,
		lng: 149.3033,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Hayman Island",
		aac: "QLD_TP184",
		lat: -20.05,
		lng: 148.8833,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Heron Island",
		aac: "QLD_TP075",
		lat: -23.4333,
		lng: 151.9,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Hobart",
		aac: "TAS_TP003",
		lat: -42.8773,
		lng: 147.341,
		tz: "Australia/Hobart",
		primary: true
	},
	{
		name: "Hook Island",
		aac: "QLD_TP189",
		lat: -20.0667,
		lng: 148.9333,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Ince Point",
		aac: "QLD_TP028",
		lat: -10.575,
		lng: 142.3117,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Karumba",
		aac: "QLD_TP013",
		lat: -17.4917,
		lng: 140.8333,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Lady Elliot Island",
		aac: "QLD_TP158",
		lat: -24.1167,
		lng: 152.7167,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Lady Musgrave Island",
		aac: "QLD_TP157",
		lat: -23.9167,
		lng: 152.3833,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Lakes Entrance",
		aac: "VIC_TP001",
		lat: -37.8892,
		lng: 147.9728,
		tz: "Australia/Melbourne",
		primary: true
	},
	{
		name: "Leggatt Island",
		aac: "QLD_TP014",
		lat: -14.5333,
		lng: 144.85,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Lizard Island (QLD)",
		aac: "QLD_TP016",
		lat: -14.65,
		lng: 145.45,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Low Head",
		aac: "TAS_TP004",
		lat: -41.0651,
		lng: 146.7947,
		tz: "Australia/Hobart",
		primary: true
	},
	{
		name: "Lucinda (Offshore)",
		aac: "QLD_TP017",
		lat: -18.5217,
		lng: 146.385,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Mackay Outer Harbour",
		aac: "QLD_TP018",
		lat: -21.1167,
		lng: 149.2333,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Melbourne (Williamstown)",
		aac: "VIC_TP003",
		lat: -37.8657,
		lng: 144.9165,
		tz: "Australia/Melbourne",
		primary: true
	},
	{
		name: "Melville Bay (Gove Harbour)",
		aac: "NT_TP002",
		lat: -12.2067,
		lng: 136.6717,
		tz: "Australia/Darwin",
		primary: true
	},
	{
		name: "Middle Island (Keppel Isles)",
		aac: "QLD_TP165",
		lat: -23.1667,
		lng: 150.9333,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Milner Bay (Groote Eylandt)",
		aac: "NT_TP003",
		lat: -13.8601,
		lng: 136.4156,
		tz: "Australia/Darwin",
		primary: true
	},
	{
		name: "Mooloolaba",
		aac: "QLD_TP019",
		lat: -26.6867,
		lng: 153.12,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Mourilyan Harbour",
		aac: "QLD_TP020",
		lat: -17.6,
		lng: 146.1167,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Nardana Patches",
		aac: "QLD_TP029",
		lat: -10.5047,
		lng: 142.2438,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Newcastle",
		aac: "NSW_TP004",
		lat: -32.9238,
		lng: 151.7889,
		tz: "Australia/Sydney",
		primary: true
	},
	{
		name: "One Tree Islet",
		aac: "QLD_TP160",
		lat: -23.5,
		lng: 152.05,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "One Tree Point",
		aac: "NT_TP084",
		lat: -11.15,
		lng: 132.7167,
		tz: "Australia/Darwin",
		primary: false
	},
	{
		name: "Onslow (Beadon Creek)",
		aac: "WA_TP018",
		lat: -21.6497,
		lng: 115.1315,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Point Lonsdale",
		aac: "VIC_TP009",
		lat: -38.2919,
		lng: 144.6139,
		tz: "Australia/Melbourne",
		primary: true
	},
	{
		name: "Port Adelaide (Outer Harbor)",
		aac: "SA_TP001",
		lat: -34.7798,
		lng: 138.4807,
		tz: "Australia/Adelaide",
		primary: true
	},
	{
		name: "Port Alma",
		aac: "QLD_TP022",
		lat: -23.585,
		lng: 150.8667,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Port Douglas",
		aac: "QLD_TP023",
		lat: -16.4833,
		lng: 145.4667,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Port Giles",
		aac: "SA_TP002",
		lat: -35.0218,
		lng: 137.7683,
		tz: "Australia/Adelaide",
		primary: true
	},
	{
		name: "Port Hedland",
		aac: "WA_TP020",
		lat: -20.3176,
		lng: 118.5744,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Port Kembla",
		aac: "NSW_TP006",
		lat: -34.475,
		lng: 150.91,
		tz: "Australia/Sydney",
		primary: true
	},
	{
		name: "Port Lincoln",
		aac: "SA_TP003",
		lat: -34.7159,
		lng: 135.8701,
		tz: "Australia/Adelaide",
		primary: true
	},
	{
		name: "Port Pirie",
		aac: "SA_TP004",
		lat: -33.1776,
		lng: 138.0117,
		tz: "Australia/Adelaide",
		primary: true
	},
	{
		name: "Port Walcott (Cape Lambert)",
		aac: "WA_TP021",
		lat: -20.588,
		lng: 117.186,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Port Welshpool Pier",
		aac: "VIC_TP010",
		lat: -38.7,
		lng: 146.4667,
		tz: "Australia/Melbourne",
		primary: true
	},
	{
		name: "Portland",
		aac: "VIC_TP011",
		lat: -38.3514,
		lng: 141.6197,
		tz: "Australia/Melbourne",
		primary: true
	},
	{
		name: "Rosslyn Bay",
		aac: "QLD_TP024",
		lat: -23.1667,
		lng: 150.7917,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Shute Harbour",
		aac: "QLD_TP025",
		lat: -20.2833,
		lng: 148.7833,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Spring Bay",
		aac: "TAS_TP007",
		lat: -42.5486,
		lng: 147.9283,
		tz: "Australia/Hobart",
		primary: true
	},
	{
		name: "Stanley",
		aac: "TAS_TP008",
		lat: -40.7667,
		lng: 145.3,
		tz: "Australia/Hobart",
		primary: true
	},
	{
		name: "Sydney (Fort Denison)",
		aac: "NSW_TP007",
		lat: -33.8547,
		lng: 151.2258,
		tz: "Australia/Sydney",
		primary: true
	},
	{
		name: "Thevenard",
		aac: "SA_TP005",
		lat: -32.1489,
		lng: 133.6413,
		tz: "Australia/Adelaide",
		primary: true
	},
	{
		name: "Thevenard Island",
		aac: "WA_TP022",
		lat: -21.4667,
		lng: 115.0167,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Three Hummock Island",
		aac: "TAS_TP042",
		lat: -40.45,
		lng: 144.8333,
		tz: "Australia/Hobart",
		primary: false
	},
	{
		name: "Thursday Island",
		aac: "QLD_TP030",
		lat: -10.5863,
		lng: 142.2216,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Townsville",
		aac: "QLD_TP033",
		lat: -19.25,
		lng: 146.8333,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Tryon Island",
		aac: "QLD_TP162",
		lat: -23.2333,
		lng: 151.7667,
		tz: "Australia/Brisbane",
		primary: false
	},
	{
		name: "Turtle Head",
		aac: "QLD_TP031",
		lat: -10.5212,
		lng: 142.2133,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Twin Island",
		aac: "QLD_TP032",
		lat: -10.4577,
		lng: 142.4443,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Urangan",
		aac: "QLD_TP034",
		lat: -25.2983,
		lng: 152.9083,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Victor Harbor",
		aac: "SA_TP006",
		lat: -35.5625,
		lng: 138.6354,
		tz: "Australia/Adelaide",
		primary: true
	},
	{
		name: "Waddy Point (K'gari)",
		aac: "QLD_TP035",
		lat: -24.9667,
		lng: 153.35,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Wallaroo",
		aac: "SA_TP007",
		lat: -33.926,
		lng: 137.6152,
		tz: "Australia/Adelaide",
		primary: true
	},
	{
		name: "Weipa (Humbug Point)",
		aac: "QLD_TP036",
		lat: -12.67,
		lng: 141.8633,
		tz: "Australia/Brisbane",
		primary: true
	},
	{
		name: "Western Port (Stony Point)",
		aac: "VIC_TP013",
		lat: -38.3739,
		lng: 145.2228,
		tz: "Australia/Melbourne",
		primary: true
	},
	{
		name: "Whyalla",
		aac: "SA_TP008",
		lat: -33.0128,
		lng: 137.5904,
		tz: "Australia/Adelaide",
		primary: true
	},
	{
		name: "Wyndham",
		aac: "WA_TP023",
		lat: -15.4533,
		lng: 128.101,
		tz: "Australia/Perth",
		primary: true
	},
	{
		name: "Yamba",
		aac: "NSW_TP008",
		lat: -29.429,
		lng: 153.3621,
		tz: "Australia/Sydney",
		primary: true
	},
	{
		name: "Yampi Sound (Koolan Island)",
		aac: "WA_TP024",
		lat: -16.1389,
		lng: 123.7381,
		tz: "Australia/Perth",
		primary: true
	}
];
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
/** Browser cannot fetch BOM (no CORS). This runs on the server. */
var fetchBomPrint = createServerFn({ method: "GET" }).validator(object({
	aac: string().regex(/^[A-Z]{2,4}_TP[0-9]{3,4}$/),
	tz: string().regex(/^[A-Za-z]+\/[A-Za-z_]+$/)
})).handler(createSsrRpc("2e16fc0afdf81763e19ecc7185cbdf72f38d08d23f03b8c5f1fa55e2c29b9961"));
var tide_station_exports = /* @__PURE__ */ __exportAll({
	BOM_PORTS: () => BOM_PORTS,
	fetchBomStationTide: () => fetchBomStationTide,
	modelTideOrigin: () => modelTideOrigin,
	nearestBomPort: () => nearestBomPort,
	tideOriginChip: () => tideOriginChip,
	tideOriginLabel: () => tideOriginLabel
});
var MAX_KM = 120;
var cache = /* @__PURE__ */ new Map();
function nearestBomPort(p, maxKm = MAX_KM) {
	let best = null;
	let bestM = Infinity;
	for (const port of BOM_PORTS) {
		const m = haversineMeters(p, port);
		if (m < bestM) {
			bestM = m;
			best = port;
		}
	}
	if (!best) return null;
	const km = bestM / 1e3;
	if (km > maxKm) return null;
	return {
		port: best,
		km: Math.round(km * 10) / 10
	};
}
async function fetchBomStationTide(lat, lng, now = Date.now()) {
	const near = nearestBomPort({
		lat,
		lng
	});
	if (!near) return null;
	const key = `${near.port.aac}:${new Date(now).toISOString().slice(0, 10)}`;
	const hit = cache.get(key);
	if (hit && now - hit.at < 108e5) return hit;
	const turns = (await fetchBomPrint({ data: {
		aac: near.port.aac,
		tz: near.port.tz
	} })).turns;
	if (turns.length < 2) return null;
	const hours = hoursFromTurns(turns, now - 36e5, 168);
	if (hours.length < 4) return null;
	const row = {
		at: now,
		hours,
		turns,
		origin: {
			kind: "station",
			name: near.port.name,
			aac: near.port.aac,
			km: near.km,
			primary: near.port.primary,
			datum: "LAT"
		}
	};
	cache.set(key, row);
	return row;
}
function modelTideOrigin() {
	return {
		kind: "model",
		name: "Open-Meteo marine",
		datum: "LAT estimate"
	};
}
function tideOriginLabel(o) {
	if (!o) return "Tide";
	if (o.kind === "station") {
		const dist = o.km < 1 ? "<1 km" : `${o.km < 10 ? o.km.toFixed(1) : Math.round(o.km)} km`;
		const grade = o.primary ? "standard port" : "secondary port";
		return `BOM tide table · ${o.name} (${grade}) · ${dist} · LAT`;
	}
	return "Marine model · LAT estimate — not a tide station";
}
function tideOriginChip(o) {
	if (o?.kind === "station") return "Tide · BOM";
	return "Tide · model";
}
//#endregion
export { msToKnots as C, turnDegrees as D, reverseWaypoints as E, wrapDegrees as O, lerpBearing as S, pointInPolygon as T, formatLng as _, tide_station_exports as a, hullScreenHeading as b, appendTrail as c, closestOnSegment as d, crossTrackMeters as f, formatLat as g, formatHeading as h, tideOriginLabel as i, bearingDegrees as l, formatGroundScale as m, modelTideOrigin as n, createSsrRpc as o, destPoint as p, tideOriginChip as r, fetchBomStationTide as t, chartBearing as u, formatMeters as v, pathLengthMeters as w, isChartUp as x, haversineMeters as y };
