import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { v as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as require_jsx_runtime, t as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { r as createServerFn } from "./ssr.mjs";
import { a as parseTideHours, c as tideRiseAt, d as toLatM, f as windowTide, l as tideRising, o as tideAt, r as latDatumM, s as tideRange, t as fetchTideRise, u as tideTurns } from "./tides-VTljZa2R.mjs";
import { cn as _enum, dn as boolean, gn as object, hn as number, un as array, yn as string } from "../_libs/@better-auth/core+[...].mjs";
import { i as signOut, t as authClient } from "./client-B40BzJxt.mjs";
import { a as hasGateSessionMarker } from "./server-DabOsYvr.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { n as cn, t as Button } from "./button-CvZvv-hb.mjs";
import { t as authMiddleware } from "./middleware-DhUlioyT.mjs";
import { a as Ship, c as Pencil, d as LocateFixed, f as BookOpen, i as Square, l as Moon, m as Anchor, o as Satellite, p as Bell, r as Sun, s as Radio, t as Undo2, u as Map } from "../_libs/lucide-react.mjs";
import { C as msToKnots, D as turnDegrees, E as reverseWaypoints, O as wrapDegrees, S as lerpBearing, T as pointInPolygon, _ as formatLng, b as hullScreenHeading, c as appendTrail, d as closestOnSegment, f as crossTrackMeters, g as formatLat, h as formatHeading, i as tideOriginLabel, l as bearingDegrees, m as formatGroundScale, n as modelTideOrigin, o as createSsrRpc, p as destPoint, r as tideOriginChip, t as fetchBomStationTide, u as chartBearing, v as formatMeters, w as pathLengthMeters, x as isChartUp, y as haversineMeters } from "./tide-station-CdgGseon.mjs";
import { n as toast, t as Toaster } from "../_libs/sonner.mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-qFfGlCW9.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DEFAULT_REEF_ID = "lady-musgrave";
var REEFS = [
	{
		id: "lady-musgrave",
		name: "Lady Musgrave",
		region: "Great Barrier Reef",
		country: "Australia",
		lat: -23.904,
		lng: 152.395,
		zoom: 16,
		blurb: "A navigable coral lagoon with one north-west cut. Dark water is the channel; brown is coral. Sand patches inside for the hook."
	},
	{
		id: "heart-reef",
		name: "Heart Reef",
		region: "Hardy Reef, Whitsundays",
		country: "Australia",
		lat: -19.742,
		lng: 149.185,
		zoom: 16,
		blurb: "The heart sits inside Hardy Reef. Stay in the indigo channels — the formation itself is protected and too shallow."
	},
	{
		id: "heron-island",
		name: "Heron Island",
		region: "Capricornia Cays",
		country: "Australia",
		lat: -23.4425,
		lng: 151.9145,
		zoom: 15,
		blurb: "Research cay with a dredged south-west harbour. Coral gardens start the moment you leave the cut."
	},
	{
		id: "whitehaven",
		name: "Hill Inlet",
		region: "Whitsundays",
		country: "Australia",
		lat: -20.27,
		lng: 149.018,
		zoom: 15,
		blurb: "Silica swirl of Hill Inlet. Drying banks shift with tide — the colour of the water is the chart."
	},
	{
		id: "agincourt",
		name: "Agincourt Reef",
		region: "Outer GBR",
		country: "Australia",
		lat: -16.041,
		lng: 145.868,
		zoom: 15,
		blurb: "Ribbon of outer reef off Port Douglas. Outer wall drops to the Coral Sea; inner water threads between bommies."
	},
	{
		id: "lizard",
		name: "Lizard Island",
		region: "Northern GBR",
		country: "Australia",
		lat: -14.668,
		lng: 145.462,
		zoom: 14,
		blurb: "Granite island, fringing reef. Watsons Bay is the classic sand anchorage in settled weather."
	},
	{
		id: "coral-bay",
		name: "Coral Bay",
		region: "Ningaloo Reef",
		country: "Australia",
		lat: -23.145,
		lng: 113.768,
		zoom: 14,
		blurb: "Fringing reef a few hundred metres off the beach. Cardabia and Yalobia passages cut through to the Indian Ocean."
	},
	{
		id: "turquoise-bay",
		name: "Turquoise Bay",
		region: "Ningaloo Reef",
		country: "Australia",
		lat: -22.089,
		lng: 113.89,
		zoom: 16,
		blurb: "Pale sand, dark coral fingers, and a north-setting drift. Read the fingers before you close the beach."
	},
	{
		id: "rowley",
		name: "Clerke Reef",
		region: "Rowley Shoals",
		country: "Australia",
		lat: -17.31,
		lng: 119.35,
		zoom: 13,
		blurb: "Remote atoll 160 nm off Broome. One pass into a lagoon of sand and coral heads."
	},
	{
		id: "bora-bora",
		name: "Teavanui Pass",
		region: "Bora Bora",
		country: "French Polynesia",
		lat: -16.494,
		lng: -151.762,
		zoom: 14,
		blurb: "The only pass into Bora Bora’s lagoon. Deep, well used, with coral walls that read clearly from altitude."
	},
	{
		id: "rangiroa",
		name: "Tiputa Pass",
		region: "Rangiroa",
		country: "French Polynesia",
		lat: -14.972,
		lng: -147.623,
		zoom: 14,
		blurb: "A river of indigo between two pale reef flats. Incoming current is famous — time the pass."
	},
	{
		id: "blue-hole",
		name: "Great Blue Hole",
		region: "Lighthouse Reef",
		country: "Belize",
		lat: 17.316,
		lng: -87.535,
		zoom: 15,
		blurb: "Circular sinkhole inside Lighthouse Reef. Approach via the atoll’s cuts, never over the rim."
	},
	{
		id: "palau",
		name: "Rock Islands",
		region: "Palau",
		country: "Palau",
		lat: 7.246,
		lng: 134.376,
		zoom: 13,
		blurb: "Limestone maze. Satellite is how you pick the sand corridors between the mushroom islands."
	},
	{
		id: "male-atoll",
		name: "North Malé Atoll",
		region: "Maldives",
		country: "Maldives",
		lat: 4.32,
		lng: 73.52,
		zoom: 12,
		blurb: "House reefs and a deep inner sea. Every resort channel is a pale cut in the coral."
	}
];
function getReef(id) {
	return REEFS.find((r) => r.id === id) ?? REEFS[0];
}
function nearestReef(lat, lng, maxM = 12e3) {
	let best = null;
	let bestD = maxM;
	for (const r of REEFS) {
		const d = haversineMeters({
			lat,
			lng
		}, r);
		if (d < bestD) {
			bestD = d;
			best = r;
		}
	}
	return best;
}
var IMAGERY = [
	{
		id: "auto",
		name: "Auto — never blank",
		detail: "Google and Maxar stacked on Sentinel-2. Sharp at the boat where a mosaic exists; colour-of-water fills remote reef so the chart never greys out."
	},
	{
		id: "google",
		name: "Google Satellite",
		detail: "Sharpest helm view. Native detail in close to the boat on well-photographed reefs. Sentinel underneath if a tile is missing."
	},
	{
		id: "maxar",
		name: "Maxar (Esri)",
		detail: "Highest lagoon and cay detail. Stops around 60 cm on remote water — Auto/Google keep going in. Sentinel fills the gaps."
	},
	{
		id: "clarity",
		name: "Maxar Clarity",
		detail: "A different Maxar mosaic. Often cleaner on Ningaloo and Cape York outer reef. Sentinel underneath."
	},
	{
		id: "bing",
		name: "Bing Aerial",
		detail: "Holds native tiles farther out on remote reef than Maxar. Useful on the outer ribbon. Sentinel underneath."
	},
	{
		id: "sentinel",
		name: "Sentinel-2 cloudless",
		detail: "10 m Copernicus mosaic of the whole ocean. Best colour-of-water read when photo mosaics have no tile."
	}
];
var ESRI_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
var CLARITY_URL = "https://clarity.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
var SENTINEL_URL = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg";
var GOOGLE_URL = "https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}";
var LABELS_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
var SEAMARK_URL = "https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png";
var DEPTH_WMS_URL = "https://depth.openseamap.org/geoserver/openseamap/wms";
var DEPTH_WMS_LAYERS = "openseamap:contour2,openseamap:contour";
var GARMIN_SDK_URL = "https://developer.garmin.com/marine-charts/mobile";
var ATTR_ESRI = "Maxar © Esri, Maxar, Earthstar Geographics";
var ATTR_SENTINEL = "Sentinel-2 cloudless © EOX / Copernicus";
var ATTR_GOOGLE = "Imagery © Google";
var ATTR_BING = "Aerial © Microsoft";
var ATTR_OPENSEAMAP = "Seamarks & depths © OpenSeaMap contributors";
/** Follow-the-boat helm zoom — close enough to read bommies. */
var HELM_ZOOM = 19.5;
/** Drive-by-eye zoom, a boat-length or two of water. */
var CLOSE_ZOOM = 20.75;
function bingTileUrl(x, y, z) {
	let q = "";
	for (let i = z; i > 0; i -= 1) {
		let d = 0;
		const mask = 1 << i - 1;
		if ((x & mask) !== 0) d += 1;
		if ((y & mask) !== 0) d += 2;
		q += String(d);
	}
	return `https://ecn.t${(x + y) % 4}.tiles.virtualearth.net/tiles/a${q}.jpeg?g=14400`;
}
function isImageryId(v) {
	return v === "auto" || v === "google" || v === "maxar" || v === "clarity" || v === "bing" || v === "sentinel";
}
var DB_NAME = "reefpilot-tiles";
var DB_VER = 1;
var AVG_TILE = 28e3;
var MAX_TILES = 8e3;
var SOURCES = ["sentinel", "maxar"];
var PACK_ZOOMS = [
	16,
	17,
	18,
	19
];
var abort = null;
function lngToTile(lng, z) {
	return Math.floor((lng + 180) / 360 * 2 ** z);
}
function latToTile(lat, z) {
	const n = 2 ** z;
	const φ = lat * Math.PI / 180;
	const y = (1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2 * n;
	return Math.floor(y);
}
function tileRange(b, z) {
	const n = 2 ** z;
	const x0 = Math.max(0, lngToTile(b.west, z));
	const x1 = Math.min(n - 1, lngToTile(b.east, z));
	const y0 = Math.max(0, latToTile(b.north, z));
	const y1 = Math.min(n - 1, latToTile(b.south, z));
	return {
		x0,
		x1,
		y0,
		y1,
		count: Math.max(0, x1 - x0 + 1) * Math.max(0, y1 - y0 + 1)
	};
}
function countTiles(b, minZ, maxZ) {
	let n = 0;
	for (let z = minZ; z <= maxZ; z += 1) n += tileRange(b, z).count;
	return n;
}
function boxKm(b) {
	const midLat = (b.south + b.north) / 2;
	const midLng = (b.west + b.east) / 2;
	const ns = haversineMeters({
		lat: b.south,
		lng: midLng
	}, {
		lat: b.north,
		lng: midLng
	});
	const ew = haversineMeters({
		lat: midLat,
		lng: b.west
	}, {
		lat: midLat,
		lng: b.east
	});
	return Math.max(ns, ew) / 1e3;
}
function boxAround(p, radiusM) {
	const n = destPoint(p, 0, radiusM);
	const s = destPoint(p, 180, radiusM);
	const e = destPoint(p, 90, radiusM);
	const w = destPoint(p, 270, radiusM);
	return {
		north: n.lat,
		south: s.lat,
		east: e.lng,
		west: w.lng
	};
}
function packName(b) {
	const reef = nearestReef((b.south + b.north) / 2, (b.west + b.east) / 2, 14e3);
	if (reef) return reef.name;
	return "This view";
}
function boxFromCorners(a, b) {
	return {
		south: Math.min(a.lat, b.lat),
		north: Math.max(a.lat, b.lat),
		west: Math.min(a.lng, b.lng),
		east: Math.max(a.lng, b.lng)
	};
}
function packCovers(pack, lat, lng, needZ = 16) {
	const b = pack.bounds;
	return pack.maxZ >= needZ && lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}
function packOnPhone(packs, lat, lng, needZ = 16) {
	return packs.find((p) => packCovers(p, lat, lng, needZ)) ?? null;
}
function resolveMaxZ(quality) {
	if (quality === "helm") return 18;
	if (quality === "close") return 19;
	return quality;
}
function estimatePack(b, quality = 18) {
	const km = boxKm(b);
	const maxZ = resolveMaxZ(quality);
	const minZ = 16;
	const tiles = countTiles(b, minZ, maxZ) * SOURCES.length;
	const tooWide = km > 14 || tiles > MAX_TILES || km < .15;
	return {
		tiles,
		bytes: tiles * AVG_TILE,
		minZ,
		maxZ,
		km,
		tooWide
	};
}
function formatBytes(n) {
	if (n < 9e5) return `${Math.max(1, Math.round(n / 1024))} KB`;
	return `${(n / 1048576).toFixed(n >= 10485760 ? 0 : 1)} MB`;
}
function tileKey(source, z, x, y) {
	return `${source}/${z}/${x}/${y}`;
}
function tileUrl(source, z, x, y) {
	return (source === "maxar" ? ESRI_URL : SENTINEL_URL).replace("{z}", String(z)).replace("{y}", String(y)).replace("{x}", String(x));
}
function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VER);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains("tiles")) db.createObjectStore("tiles");
			if (!db.objectStoreNames.contains("packs")) db.createObjectStore("packs");
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
async function readTile(key) {
	if (typeof indexedDB === "undefined") return null;
	try {
		const db = await openDb();
		return await new Promise((resolve, reject) => {
			const req = db.transaction("tiles", "readonly").objectStore("tiles").get(key);
			req.onsuccess = () => resolve(req.result ?? null);
			req.onerror = () => reject(req.error);
		});
	} catch {
		return null;
	}
}
async function putTile(key, blob) {
	const db = await openDb();
	await new Promise((resolve, reject) => {
		const tx = db.transaction("tiles", "readwrite");
		tx.objectStore("tiles").put(blob, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
async function listPacks() {
	if (typeof indexedDB === "undefined") return [];
	try {
		const db = await openDb();
		return await new Promise((resolve, reject) => {
			const req = db.transaction("packs", "readonly").objectStore("packs").getAll();
			req.onsuccess = () => {
				const rows = req.result ?? [];
				rows.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
				resolve(rows);
			};
			req.onerror = () => reject(req.error);
		});
	} catch {
		return [];
	}
}
async function deletePack(id) {
	const pack = (await listPacks()).find((p) => p.id === id);
	const db = await openDb();
	await new Promise((resolve, reject) => {
		const tx = db.transaction(["tiles", "packs"], "readwrite");
		const tiles = tx.objectStore("tiles");
		if (pack) for (const source of pack.sources) for (let z = pack.minZ; z <= pack.maxZ; z += 1) {
			const r = tileRange(pack.bounds, z);
			for (let x = r.x0; x <= r.x1; x += 1) for (let y = r.y0; y <= r.y1; y += 1) tiles.delete(tileKey(source, z, x, y));
		}
		tx.objectStore("packs").delete(id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
async function savePackMeta(pack) {
	const db = await openDb();
	await new Promise((resolve, reject) => {
		const tx = db.transaction("packs", "readwrite");
		tx.objectStore("packs").put(pack, pack.id);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
function cancelPackDownload() {
	abort?.abort();
}
async function downloadPack(b, quality, name, onProgress) {
	const est = estimatePack(b, quality);
	if (est.tooWide) throw new Error("Zoom in on the reef — packs cover a lagoon, not the ocean.");
	navigator.storage?.persist?.();
	abort?.abort();
	abort = new AbortController();
	const signal = abort.signal;
	const jobs = [];
	for (const source of SOURCES) for (let z = est.minZ; z <= est.maxZ; z += 1) {
		const r = tileRange(b, z);
		for (let x = r.x0; x <= r.x1; x += 1) for (let y = r.y0; y <= r.y1; y += 1) jobs.push({
			source,
			z,
			x,
			y
		});
	}
	let done = 0;
	let bytes = 0;
	const workers = 6;
	let cursor = 0;
	const run = async () => {
		while (cursor < jobs.length) {
			if (signal.aborted) throw new DOMException("cancelled", "AbortError");
			const i = cursor;
			cursor += 1;
			const job = jobs[i];
			const key = tileKey(job.source, job.z, job.x, job.y);
			const hit = await readTile(key);
			if (hit && hit.size >= 3200) bytes += hit.size;
			else {
				const url = tileUrl(job.source, job.z, job.x, job.y);
				const res = await fetch(url, {
					mode: "cors",
					signal
				});
				if (res.ok) {
					const blob = await res.blob();
					if (blob.size >= 3200) {
						await putTile(key, blob);
						bytes += blob.size;
					}
				}
			}
			done += 1;
			if (done % 8 === 0 || done === jobs.length) onProgress({
				done,
				total: jobs.length,
				bytes
			});
		}
	};
	await Promise.all(Array.from({ length: workers }, () => run()));
	const pack = {
		id: `${Date.now().toString(36)}-${Math.round(Math.random() * 1e4).toString(36)}`,
		name,
		bounds: b,
		minZ: est.minZ,
		maxZ: est.maxZ,
		sources: [...SOURCES],
		tiles: jobs.length,
		bytes,
		savedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	await savePackMeta(pack);
	abort = null;
	return pack;
}
var DEFAULT_RODE = {
	depthM: 8,
	chainM: 40,
	bowM: 1.5,
	loaM: 12,
	chainTotalM: 60,
	scopeTarget: 5,
	tideRiseM: 0,
	tideHighAt: null,
	tideManual: false
};
function laybackM(rode) {
	return Math.max(0, rode.chainM - rode.depthM - rode.bowM);
}
function tautHorizM(chainM, depthM) {
	if (chainM <= depthM) return 0;
	return Math.sqrt(chainM * chainM - depthM * depthM);
}
function swingRadiusM(chainM, depthM, loaM, gpsReachM) {
	const extra = gpsReachM != null && gpsReachM > loaM / 2 ? gpsReachM : loaM / 2;
	return Math.round(tautHorizM(chainM, depthM) + extra);
}
function rodeMath(rode, gpsReachM) {
	const nowDepthM = rode.depthM + rode.bowM;
	const hwDepthM = nowDepthM + Math.max(0, rode.tideRiseM);
	const needHwM = rode.scopeTarget * hwDepthM;
	const shortHwM = Math.max(0, needHwM - rode.chainM);
	const scopeNow = rode.chainM / Math.max(.1, nowDepthM);
	const scopeHw = rode.chainM / Math.max(.1, hwDepthM);
	return {
		nowDepthM,
		hwDepthM,
		needHwM,
		shortHwM,
		scopeNow,
		scopeHw,
		status: scopeHw < 3 ? "critical" : shortHwM > .05 ? "short" : "ok",
		radiusM: swingRadiusM(rode.chainM, hwDepthM, rode.loaM, gpsReachM),
		overTotal: needHwM > rode.chainTotalM,
		laybackM: laybackM(rode)
	};
}
function suggestedPayOutM(rode, math = rodeMath(rode)) {
	const need = Math.ceil(math.needHwM);
	return Math.min(rode.chainTotalM, Math.max(rode.chainM, need));
}
function clampRode(partial, base = DEFAULT_RODE) {
	const n = (v, fallback, min, max) => {
		if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
		return Math.min(max, Math.max(min, v));
	};
	const scope = partial.scopeTarget === 3 || partial.scopeTarget === 5 || partial.scopeTarget === 7 ? partial.scopeTarget : base.scopeTarget;
	return {
		depthM: n(partial.depthM, base.depthM, 0, 80),
		chainM: n(partial.chainM, base.chainM, 5, 400),
		bowM: n(partial.bowM, base.bowM, 0, 8),
		loaM: n(partial.loaM, base.loaM, 4, 80),
		chainTotalM: n(partial.chainTotalM, base.chainTotalM, 10, 400),
		scopeTarget: scope,
		tideRiseM: n(partial.tideRiseM, base.tideRiseM, 0, 12),
		tideHighAt: typeof partial.tideHighAt === "number" && Number.isFinite(partial.tideHighAt) ? partial.tideHighAt : partial.tideHighAt === null ? null : base.tideHighAt,
		tideManual: typeof partial.tideManual === "boolean" ? partial.tideManual : base.tideManual
	};
}
function clampAlarmRadius(m) {
	if (!Number.isFinite(m)) return 40;
	return Math.max(12, Math.min(800, Math.round(m)));
}
function snapToLayback(boat, finger, rode) {
	const lay = Math.max(8, laybackM(rode));
	const brg = bearingDegrees(boat, finger);
	return destPoint(boat, brg, lay);
}
function hookAstern(boat, rode) {
	const lay = Math.max(8, laybackM(rode));
	const hdg = boat.heading ?? 0;
	return destPoint(boat, hdg + 180, lay);
}
function boatInsideWatch(boat, watch) {
	if (watch.fence && watch.fence.length >= 3) return pointInPolygon(boat, watch.fence);
	return haversineMeters(boat, watch) <= watch.radiusM;
}
function rodeDropNote(rode) {
	const math = rodeMath(rode);
	if (math.status === "ok") return null;
	const extra = Math.ceil(math.shortHwM);
	if (math.status === "critical") return `Under 3:1 at high water — let ${extra} m more chain.`;
	return `short ${extra} m for ${rode.scopeTarget}:1 at HW`;
}
function formatScope(n) {
	if (!Number.isFinite(n) || n <= 0) return "—";
	return `${n.toFixed(1)}:1`;
}
function hoursUntil(at, now = Date.now()) {
	if (!at) return "";
	const h = (at - now) / 36e5;
	if (h < .08) return "now";
	if (h < 1) return `${Math.round(h * 60)} min`;
	const hr = Math.floor(h);
	const min = Math.round((h - hr) * 60);
	if (min === 60) return `${hr + 1} h`;
	return min ? `${hr} h ${min} m` : `${hr} h`;
}
function appendSwingTrail(trail, p) {
	const last = trail[trail.length - 1];
	if (last && haversineMeters(last, p) < 3) return trail;
	const next = [...trail, {
		lat: p.lat,
		lng: p.lng
	}];
	return next.length > 800 ? next.slice(-800) : next;
}
var ALARM_SOUNDS = [
	{
		id: "klaxon",
		name: "Klaxon",
		detail: "Two-tone bridge"
	},
	{
		id: "foghorn",
		name: "Foghorn",
		detail: "Low blast"
	},
	{
		id: "bell",
		name: "Bell",
		detail: "Fast pings"
	}
];
function isAlarmSound(v) {
	return v === "klaxon" || v === "foghorn" || v === "bell";
}
var ctx = null;
var loopTimer = null;
var stopTimer = null;
var voices = [];
var loopingId = null;
function audio() {
	if (typeof window === "undefined") return null;
	const AC = window.AudioContext || window.webkitAudioContext;
	if (!AC) return null;
	ctx ??= new AC();
	return ctx;
}
function unlockAlarmAudio() {
	const a = audio();
	if (a && a.state === "suspended") a.resume();
}
function pulse(a, freq, durMs, peak, type, delayMs = 0) {
	const osc = a.createOscillator();
	const gain = a.createGain();
	osc.type = type;
	osc.frequency.value = freq;
	const t0 = a.currentTime + delayMs / 1e3;
	const t1 = t0 + durMs / 1e3;
	gain.gain.setValueAtTime(1e-4, t0);
	gain.gain.exponentialRampToValueAtTime(peak, t0 + .018);
	gain.gain.exponentialRampToValueAtTime(1e-4, Math.max(t0 + .03, t1));
	osc.connect(gain);
	gain.connect(a.destination);
	osc.start(t0);
	osc.stop(t1 + .04);
	voices.push({
		osc,
		gain
	});
}
function playCycle(id) {
	const a = audio();
	if (!a) return;
	if (a.state === "suspended") a.resume();
	if (id === "foghorn") {
		pulse(a, 165, 720, .16, "sine", 0);
		pulse(a, 220, 720, .12, "sawtooth", 0);
		return;
	}
	if (id === "bell") {
		pulse(a, 1760, 90, .09, "triangle", 0);
		pulse(a, 1320, 90, .08, "triangle", 110);
		pulse(a, 990, 110, .07, "triangle", 220);
		return;
	}
	pulse(a, 880, 260, .09, "square", 0);
	pulse(a, 660, 260, .08, "square", 300);
}
function periodMs(id) {
	if (id === "foghorn") return 1300;
	if (id === "bell") return 700;
	return 900;
}
function stopAlarmTone() {
	loopingId = null;
	if (loopTimer != null) {
		window.clearInterval(loopTimer);
		loopTimer = null;
	}
	if (stopTimer != null) {
		window.clearTimeout(stopTimer);
		stopTimer = null;
	}
	for (const v of voices) {
		try {
			v.osc.stop();
		} catch {}
		try {
			v.osc.disconnect();
			v.gain.disconnect();
		} catch {}
	}
	voices = [];
}
function startAlarmTone(id = "klaxon") {
	if (loopTimer != null && loopingId === id) return;
	stopAlarmTone();
	if (!audio()) return;
	loopingId = id;
	playCycle(id);
	loopTimer = window.setInterval(() => playCycle(id), periodMs(id));
}
function previewAlarm(id) {
	startAlarmTone(id);
	stopTimer = window.setTimeout(() => stopAlarmTone(), periodMs(id) * 2 + 200);
}
var STEER_PRESETS = {
	cut: {
		lookAheadM: 28,
		scaleM: 12,
		label: "Cut",
		detail: "Twitchy. Reef entrance."
	},
	track: {
		lookAheadM: 55,
		scaleM: 28,
		label: "Track",
		detail: "Normal lagoon lead."
	},
	open: {
		lookAheadM: 110,
		scaleM: 60,
		label: "Open",
		detail: "Soft. Wider water."
	}
};
var XTE_ALARM_PRESETS = [
	0,
	15,
	25,
	40,
	80
];
function isSteerSense(v) {
	return v === "cut" || v === "track" || v === "open";
}
function nextVertexIndex(boat, pts, pinned) {
	if (pts.length === 0) return -1;
	if (pinned != null && pinned >= 0 && pinned < pts.length) return pinned;
	if (pts.length === 1) return 0;
	let bestI = 0;
	let best = closestOnSegment(boat, pts[0], pts[1]);
	for (let i = 1; i < pts.length - 1; i += 1) {
		const c = closestOnSegment(boat, pts[i], pts[i + 1]);
		if (c.distM < best.distM) {
			best = c;
			bestI = i;
		}
	}
	const start = pts[0];
	if (bestI === 0 && best.t < .12 && haversineMeters(boat, start) > 18) return 0;
	const nextI = bestI + 1;
	const b = pts[nextI];
	if (best.t > .85 && haversineMeters(boat, b) < 18 && nextI < pts.length - 1) return nextI + 1;
	return nextI;
}
function markNav(boat, pts, pinned) {
	const index = nextVertexIndex(boat, pts, pinned);
	if (index < 0) return null;
	const mark = pts[index];
	const rangeM = haversineMeters(boat, mark);
	const speed = boat.speedMs ?? 0;
	const ttgS = speed >= .25 && rangeM > 1 ? rangeM / speed : null;
	return {
		index,
		label: mark.label && mark.label.trim() ? mark.label.trim() : `WP ${index + 1}`,
		rangeM,
		bearing: bearingDegrees(boat, mark),
		ttgS,
		pinned: pinned === index,
		last: index === pts.length - 1
	};
}
function formatTtg(seconds) {
	if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
	if (seconds < 90) return `${Math.max(1, Math.round(seconds))} s`;
	const min = Math.round(seconds / 60);
	if (min < 60) return `${min} min`;
	const h = Math.floor(min / 60);
	const m = min % 60;
	return m ? `${h} h ${m}` : `${h} h`;
}
/** Cross-track for the helm: metres and P/S. Positive XTE is starboard of the line. */
function formatXte(xteM) {
	if (xteM == null || !Number.isFinite(xteM)) return {
		value: "—",
		unit: "",
		side: null
	};
	const m = Math.abs(xteM);
	if (m < 1.5) return {
		value: "0",
		unit: "m",
		side: null
	};
	const side = xteM >= 0 ? "S" : "P";
	return {
		value: `${Math.round(m)}${side}`,
		unit: "m",
		side
	};
}
function alongRoute(pts, startI, t, aheadM) {
	const last = pts[pts.length - 1];
	if (pts.length < 2) return last;
	let left = Math.max(0, aheadM);
	let i = startI;
	let fromT = t;
	while (i < pts.length - 1) {
		const a = pts[i];
		const b = pts[i + 1];
		const from = fromT <= .001 ? a : destPoint(a, bearingDegrees(a, b), fromT * haversineMeters(a, b));
		const rest = haversineMeters(from, b);
		if (left <= rest || i === pts.length - 2) {
			if (rest < 1) return b;
			return destPoint(from, bearingDegrees(from, b), Math.min(left, rest));
		}
		left -= rest;
		i += 1;
		fromT = 0;
	}
	return last;
}
function steerCue(boat, pts, sense, alarmM) {
	if (pts.length < 2) return null;
	let bestI = 0;
	let best = closestOnSegment(boat, pts[0], pts[1]);
	for (let i = 1; i < pts.length - 1; i += 1) {
		const c = closestOnSegment(boat, pts[i], pts[i + 1]);
		if (c.distM < best.distM) {
			best = c;
			bestI = i;
		}
	}
	const a = pts[bestI];
	const b = pts[bestI + 1];
	const trackBrg = bearingDegrees(a, b);
	const xteM = crossTrackMeters(boat, a, b);
	const preset = STEER_PRESETS[sense];
	const aim = alongRoute(pts, bestI, best.t, preset.lookAheadM);
	const toAim = haversineMeters(boat, aim);
	const cts = wrapDegrees(toAim < 4 ? trackBrg : bearingDegrees(boat, aim));
	const heading = boat.heading == null || !Number.isFinite(boat.heading) ? trackBrg : boat.heading;
	const steerDeg = turnDegrees(heading, cts);
	const remainM = (() => {
		let n = haversineMeters(best.point, b);
		for (let i = bestI + 1; i < pts.length - 1; i += 1) n += haversineMeters(pts[i], pts[i + 1]);
		return n;
	})();
	const scale = Math.max(6, preset.scaleM);
	return {
		xteM,
		cts,
		trackBrg,
		steerDeg,
		cdi: Math.max(-1, Math.min(1, xteM / scale)),
		offTrack: alarmM > 0 && Math.abs(xteM) >= alarmM,
		remainM,
		aim
	};
}
var CARDINALS = [
	"N",
	"NNE",
	"NE",
	"ENE",
	"E",
	"ESE",
	"SE",
	"SSE",
	"S",
	"SSW",
	"SW",
	"WSW",
	"W",
	"WNW",
	"NW",
	"NNW"
];
function msToKn(ms) {
	return ms * 1.94384;
}
function formatKn(n) {
	if (!Number.isFinite(n)) return "—";
	const r = Math.round(n);
	if (Math.abs(n - r) < .25) return String(r);
	return (Math.round(n * 10) / 10).toFixed(1);
}
function windCardinal(deg) {
	return CARDINALS[Math.round((deg % 360 + 360) % 360 / 22.5) % 16];
}
function beaufort(kn) {
	for (const [max, n, label] of [
		[
			1,
			0,
			"Calm"
		],
		[
			4,
			1,
			"Light air"
		],
		[
			7,
			2,
			"Light breeze"
		],
		[
			11,
			3,
			"Gentle breeze"
		],
		[
			17,
			4,
			"Moderate breeze"
		],
		[
			22,
			5,
			"Fresh breeze"
		],
		[
			28,
			6,
			"Strong breeze"
		],
		[
			34,
			7,
			"Near gale"
		],
		[
			41,
			8,
			"Gale"
		],
		[
			48,
			9,
			"Strong gale"
		],
		[
			56,
			10,
			"Storm"
		],
		[
			64,
			11,
			"Violent storm"
		]
	]) if (kn < max) return {
		n,
		label
	};
	return {
		n: 12,
		label: "Hurricane"
	};
}
function skyFromWmo(code) {
	if (code === 0) return "clear";
	if (code === 1 || code === 2) return "partly";
	if (code === 3) return "cloud";
	if (code === 45 || code === 48) return "fog";
	if (code >= 71 && code <= 77 || code === 85 || code === 86) return "snow";
	if (code === 65 || code === 67 || code === 82 || code === 81) return "heavy";
	if (code >= 95) return "storm";
	if (code >= 51) return "rain";
	return "cloud";
}
function skyFromSymbol(code) {
	const c = code.replace(/_day|_night|_polartwilight/g, "");
	if (c.includes("thunder")) return "storm";
	if (c.includes("snow") || c.includes("sleet")) return "snow";
	if (c.includes("heavyrain") || c.includes("heavysleet")) return "heavy";
	if (c.includes("rain") || c.includes("shower")) return "rain";
	if (c.includes("fog")) return "fog";
	if (c === "cloudy") return "cloud";
	if (c.includes("partlycloudy") || c === "fair") return "partly";
	if (c.includes("clearsky")) return "clear";
	return "cloud";
}
var WX_HORIZONS = [
	6,
	12,
	24,
	48,
	72,
	168,
	336
];
function clampWxHorizon(h) {
	if (!Number.isFinite(h)) return 48;
	return Math.max(6, Math.min(336, Math.round(h)));
}
function horizonLabel(h) {
	if (h < 24) return `${h}h`;
	const d = h / 24;
	if (h === 24) return "24h";
	if (Number.isInteger(d)) return `${d}d`;
	return `${h}h`;
}
function hourLabel(at) {
	return new Date(at).toLocaleTimeString([], { hour: "numeric" });
}
function clockLabel(at) {
	return new Date(at).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit"
	});
}
function nearestSample(hours, at) {
	if (hours.length === 0) return null;
	let best = hours[0];
	let d = Math.abs(best.at - at);
	for (const h of hours) {
		const dd = Math.abs(h.at - at);
		if (dd < d) {
			best = h;
			d = dd;
		}
	}
	return best;
}
function wxLocKey(lat, lng) {
	return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}
function windowStats(hours) {
	const now = hours[0];
	if (!now) return {
		maxWind: {
			at: Date.now(),
			windKn: 0,
			gustKn: null,
			dirDeg: 0,
			tempC: 0,
			precipMm: 0,
			cloudPct: 0,
			sky: "cloud"
		},
		rainMm: 0
	};
	let maxWind = now;
	let rainMm = 0;
	for (const h of hours) {
		if (h.windKn > maxWind.windKn) maxWind = h;
		rainMm += h.precipMm;
	}
	return {
		maxWind,
		rainMm: Math.round(rainMm * 10) / 10
	};
}
function tickLabel(at, horizonH, first) {
	if (first) return "Now";
	if (horizonH <= 48) return hourLabel(at);
	return new Date(at).toLocaleDateString([], {
		weekday: "short",
		day: "numeric"
	});
}
function sliceByHorizon(hours, horizonH) {
	if (hours.length === 0) return [];
	const end = hours[0].at + clampWxHorizon(horizonH) * 36e5;
	return hours.filter((h) => h.at <= end + 12e5);
}
function extendHours(primary, extra) {
	if (extra.length === 0) return primary;
	if (primary.length === 0) return extra;
	const last = primary[primary.length - 1].at;
	const tail = extra.filter((h) => h.at > last + 12e5);
	return tail.length ? [...primary, ...tail] : primary;
}
function horizonTicks(t0, horizonH) {
	const n = horizonH <= 12 ? 3 : horizonH <= 48 ? 4 : 5;
	const span = clampWxHorizon(horizonH) * 36e5;
	const out = [];
	for (let i = 0; i < n; i += 1) {
		const at = t0 + span * i / (n - 1);
		out.push({
			at,
			label: i === 0 ? "Now" : tickLabel(at, horizonH, false)
		});
	}
	return out;
}
function graphXAt(at, t0, horizonH, width, padL = 28, padR = 8) {
	const span = Math.max(1, horizonH) * 36e5;
	return padL + Math.max(0, Math.min(1, (at - t0) / span)) * (width - padL - padR);
}
function graphLineTimed(points, t0, horizonH, width, height, maxY, padL = 28, padR = 8, padT = 8, padB = 22) {
	const span = Math.max(1, horizonH) * 36e5;
	const end = t0 + span;
	const innerW = width - padL - padR;
	const innerH = height - padT - padB;
	const pts = points.filter((p) => p.at >= t0 - 6e4 && p.at <= end + 6e4);
	if (pts.length < 2) return "";
	return pts.map((p, i) => {
		const x = padL + (p.at - t0) / span * innerW;
		const y = padT + innerH - Math.max(0, p.v) / Math.max(1, maxY) * innerH;
		return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
	}).join(" ");
}
function graphAreaTimed(points, t0, horizonH, width, height, minV, maxV, padL = 28, padR = 8, padT = 8, padB = 22) {
	const span = Math.max(1, horizonH) * 36e5;
	const end = t0 + span;
	const innerW = width - padL - padR;
	const innerH = height - padT - padB;
	const pts = points.filter((p) => p.at >= t0 - 6e4 && p.at <= end + 6e4);
	if (pts.length < 2) return "";
	const range = Math.max(.2, maxV - minV);
	const xs = pts.map((p) => {
		return {
			x: padL + (p.at - t0) / span * innerW,
			y: padT + innerH - (p.v - minV) / range * innerH
		};
	});
	const bottom = padT + innerH;
	const first = xs[0];
	const last = xs[xs.length - 1];
	return `M${first.x.toFixed(1)} ${bottom.toFixed(1)} ` + xs.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + ` L${last.x.toFixed(1)} ${bottom.toFixed(1)} Z`;
}
function finish(hours, lat, lng, source) {
	if (hours.length < 1) throw new Error("no weather hours");
	const stats = windowStats(hours.slice(0, 24));
	return {
		lat,
		lng,
		source,
		hours,
		now: hours[0],
		maxWind: stats.maxWind,
		rainMm: stats.rainMm,
		sea: null
	};
}
function parseStamp(s) {
	if (!s) return NaN;
	if (/Z$|[+-]\d\d:\d\d$/.test(s)) return Date.parse(s);
	return Date.parse(`${s}Z`);
}
function num(v, fallback = 0) {
	return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
function parseMetNo(json, lat, lng, now = Date.now()) {
	const series = json.properties?.timeseries ?? [];
	const hours = [];
	for (const row of series) {
		const at = parseStamp(row.time ?? "");
		if (!Number.isFinite(at)) continue;
		if (at < now - 3e6) continue;
		const det = row.data?.instant?.details ?? {};
		const next = row.data?.next_1_hours;
		const windMs = num(det.wind_speed);
		const gustMs = det.wind_speed_of_gust;
		hours.push({
			at,
			windKn: Math.round(msToKn(windMs) * 10) / 10,
			gustKn: typeof gustMs === "number" && Number.isFinite(gustMs) ? Math.round(msToKn(gustMs) * 10) / 10 : null,
			dirDeg: num(det.wind_from_direction),
			tempC: Math.round(num(det.air_temperature) * 10) / 10,
			precipMm: num(next?.details?.precipitation_amount),
			cloudPct: Math.round(num(det.cloud_area_fraction)),
			sky: skyFromSymbol(next?.summary?.symbol_code ?? "")
		});
		if (hours.length >= 384) break;
	}
	return finish(hours, lat, lng, "met.no");
}
function parseOpenMeteo(json, lat, lng, now = Date.now(), source = "ecmwf") {
	const t = json.hourly?.time ?? [];
	const hours = [];
	for (let i = 0; i < t.length; i += 1) {
		const at = parseStamp(t[i] ?? "");
		if (!Number.isFinite(at) || at < now - 3e6) continue;
		const wind = num(json.hourly?.wind_speed_10m?.[i]);
		const gust = json.hourly?.wind_gusts_10m?.[i];
		hours.push({
			at,
			windKn: Math.round(wind * 10) / 10,
			gustKn: typeof gust === "number" && Number.isFinite(gust) ? Math.round(gust * 10) / 10 : null,
			dirDeg: num(json.hourly?.wind_direction_10m?.[i]),
			tempC: Math.round(num(json.hourly?.temperature_2m?.[i]) * 10) / 10,
			precipMm: num(json.hourly?.precipitation?.[i]),
			cloudPct: Math.round(num(json.hourly?.cloud_cover?.[i])),
			sky: skyFromWmo(num(json.hourly?.weather_code?.[i]))
		});
		if (hours.length >= 384) break;
	}
	return finish(hours, lat, lng, source);
}
function kmhToKn(v) {
	return Math.round(v / 1.852 * 10) / 10;
}
function parseSea(json, now = Date.now()) {
	const times = json.hourly?.time ?? [];
	const currentHours = [];
	const waveHours = [];
	let best = -1;
	let bestDiff = Infinity;
	for (let i = 0; i < times.length; i += 1) {
		const at = parseStamp(times[i] ?? "");
		if (!Number.isFinite(at)) continue;
		const diff = Math.abs(at - now);
		if (diff < bestDiff) {
			bestDiff = diff;
			best = i;
		}
		if (at >= now - 3e6) {
			const kmh = json.hourly?.ocean_current_velocity?.[i];
			const dir = json.hourly?.ocean_current_direction?.[i];
			if (currentHours.length < 192 && typeof kmh === "number" && Number.isFinite(kmh) && typeof dir === "number") currentHours.push({
				at,
				kn: kmhToKn(kmh),
				dirDeg: dir
			});
			const wh = json.hourly?.wave_height?.[i];
			const wd = json.hourly?.wave_direction?.[i];
			if (waveHours.length < 192 && typeof wh === "number" && Number.isFinite(wh)) {
				const per = json.hourly?.wave_period?.[i];
				const sw = json.hourly?.swell_wave_height?.[i];
				waveHours.push({
					at,
					heightM: Math.round(wh * 10) / 10,
					dirDeg: typeof wd === "number" && Number.isFinite(wd) ? wd : 0,
					periodS: typeof per === "number" && Number.isFinite(per) ? Math.round(per) : null,
					swellM: typeof sw === "number" && Number.isFinite(sw) ? Math.round(sw * 10) / 10 : null
				});
			}
		}
	}
	const tideHours = parseTideHours(times, json.hourly?.sea_level_height_msl ?? [], now);
	const tideTurnsList = tideTurns(tideHours);
	if (best < 0 && tideHours.length < 2) return null;
	const waveM = best >= 0 ? json.hourly?.wave_height?.[best] : null;
	const swell = best >= 0 ? json.hourly?.swell_wave_height?.[best] : null;
	const period = best >= 0 ? json.hourly?.wave_period?.[best] : null;
	const dir = best >= 0 ? json.hourly?.wave_direction?.[best] : null;
	const curKmh = best >= 0 ? json.hourly?.ocean_current_velocity?.[best] : null;
	const curDir = best >= 0 ? json.hourly?.ocean_current_direction?.[best] : null;
	const currentKn = typeof curKmh === "number" && Number.isFinite(curKmh) ? kmhToKn(curKmh) : null;
	const currentDir = typeof curDir === "number" && Number.isFinite(curDir) ? curDir : null;
	const hasWave = typeof waveM === "number" && Number.isFinite(waveM);
	if (!hasWave && currentKn == null && tideHours.length < 2) return null;
	return {
		waveM: hasWave ? Math.round(waveM * 10) / 10 : null,
		swellM: typeof swell === "number" ? Math.round(swell * 10) / 10 : null,
		periodS: typeof period === "number" ? Math.round(period) : null,
		dirDeg: typeof dir === "number" ? dir : null,
		currentKn,
		currentDir,
		currentHours,
		waveHours,
		tideHours,
		tideTurns: tideTurnsList,
		latDatumM: tideHours.length ? latDatumM(tideHours) : null,
		tideOrigin: tideHours.length ? modelTideOrigin() : null
	};
}
/** Degrees to steer off the ground course so model set does not set you off the line.
*  Water going to starboard means steer to port. Null if SOG is too low to trust it. */
function setAllowance(desiredDeg, sogKn, currentKn, currentDir) {
	if (!Number.isFinite(sogKn) || sogKn < 1.5) return null;
	if (!Number.isFinite(currentKn) || currentKn < .15) return null;
	const rel = (currentDir - desiredDeg + 540) % 360 - 180;
	const ratio = currentKn * Math.sin(rel * Math.PI / 180) / sogKn;
	if (Math.abs(ratio) >= .95) return null;
	const steer = -Math.asin(ratio) * 180 / Math.PI;
	const deg = Math.round(Math.abs(steer));
	if (deg < 2) return null;
	return {
		deg,
		side: steer >= 0 ? "S" : "P"
	};
}
async function fetchJson(url, headers) {
	const res = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(8e3)
	});
	if (!res.ok) throw new Error(`weather ${res.status}`);
	return res.json();
}
async function fetchSea(lat, lng) {
	const url = new URL("https://marine-api.open-meteo.com/v1/marine");
	url.searchParams.set("latitude", lat.toFixed(4));
	url.searchParams.set("longitude", lng.toFixed(4));
	url.searchParams.set("hourly", "wave_height,wave_direction,wave_period,swell_wave_height,ocean_current_velocity,ocean_current_direction,sea_level_height_msl");
	url.searchParams.set("forecast_days", "8");
	url.searchParams.set("timezone", "GMT");
	return parseSea(await fetchJson(url.toString()));
}
async function fetchOpenMeteo(lat, lng, model) {
	const url = new URL("https://api.open-meteo.com/v1/forecast");
	url.searchParams.set("latitude", lat.toFixed(4));
	url.searchParams.set("longitude", lng.toFixed(4));
	url.searchParams.set("hourly", "wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,temperature_2m,precipitation,cloud_cover");
	url.searchParams.set("forecast_days", "16");
	url.searchParams.set("wind_speed_unit", "kn");
	url.searchParams.set("timezone", "GMT");
	if (model !== "auto") url.searchParams.set("models", model);
	const json = await fetchJson(url.toString());
	const source = model === "ecmwf_ifs025" ? "ecmwf" : model === "gfs_global" ? "gfs" : "best";
	return parseOpenMeteo(json, lat, lng, Date.now(), source);
}
async function fetchMetNo(lat, lng) {
	return parseMetNo(await fetchJson(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`, { Accept: "application/json" }), lat, lng);
}
async function fetchWeather(lat, lng) {
	const seaP = fetchSea(lat, lng).catch(() => null);
	const ecmwfP = fetchOpenMeteo(lat, lng, "ecmwf_ifs025");
	const gfsP = fetchOpenMeteo(lat, lng, "gfs_global").catch(() => null);
	let forecast;
	try {
		forecast = await ecmwfP;
	} catch {
		forecast = await gfsP ?? await fetchOpenMeteo(lat, lng, "auto").catch(() => fetchMetNo(lat, lng));
	}
	const alt = await gfsP;
	if (alt && alt.hours.length > 2) {
		if (alt.source !== forecast.source) {
			forecast.hours = extendHours(forecast.hours, alt.hours);
			forecast.alt = {
				source: alt.source,
				hours: alt.hours
			};
		}
	}
	forecast.sea = await seaP;
	try {
		const station = await fetchBomStationTide(lat, lng);
		if (station) {
			const sea = forecast.sea ?? {
				waveM: null,
				swellM: null,
				periodS: null,
				dirDeg: null,
				currentKn: null,
				currentDir: null,
				currentHours: [],
				waveHours: [],
				tideHours: [],
				tideTurns: [],
				latDatumM: null,
				tideOrigin: null
			};
			forecast.sea = {
				...sea,
				tideHours: station.hours,
				tideTurns: station.turns,
				latDatumM: 0,
				tideOrigin: station.origin
			};
		}
	} catch {}
	return forecast;
}
function graphMaxKn(hours) {
	let m = 12;
	for (const h of hours) m = Math.max(m, h.windKn, h.gustKn ?? 0);
	return Math.max(15, Math.ceil(m / 5) * 5);
}
var DEFAULT_BOAT = {
	loaM: 12,
	beamM: 3.8,
	draftM: 1.8,
	bowM: 1.5,
	gpsFromBowM: 0,
	gpsFromCenterM: 0
};
function n(v, fallback, max = 80) {
	if (!Number.isFinite(v)) return fallback;
	return Math.min(max, Math.max(0, v));
}
function clampBoat(partial, base = DEFAULT_BOAT) {
	const loa = n(partial.loaM, base.loaM, 80);
	const beam = n(partial.beamM, base.beamM, 20);
	return {
		loaM: loa,
		beamM: beam,
		draftM: n(partial.draftM, base.draftM, 12),
		bowM: n(partial.bowM, base.bowM, 8),
		gpsFromBowM: Math.min(loa, n(partial.gpsFromBowM, base.gpsFromBowM, 80)),
		gpsFromCenterM: Math.max(-beam / 2, Math.min(beam / 2, Number.isFinite(partial.gpsFromCenterM) ? partial.gpsFromCenterM : base.gpsFromCenterM))
	};
}
/** Bow roller, given the phone/GPS fix and heading (bow direction). */
function bowFromGps(gps, heading, boat) {
	if (heading == null) return gps;
	let p = gps;
	if (boat.gpsFromBowM > .2) p = destPoint(p, heading, boat.gpsFromBowM);
	if (Math.abs(boat.gpsFromCenterM) > .2) p = destPoint(p, heading - 90, boat.gpsFromCenterM);
	return p;
}
/** Map a tap on the plan (bow at top) to a GPS station on the hull. */
function stationFromTap(x, y, width, height, boat) {
	if (width < 4 || height < 4) return {
		gpsFromBowM: boat.gpsFromBowM,
		gpsFromCenterM: boat.gpsFromCenterM
	};
	const along = Math.min(boat.loaM, Math.max(0, y / height * boat.loaM));
	const off = Math.max(-boat.beamM / 2, Math.min(boat.beamM / 2, (x / width - .5) * boat.beamM));
	return {
		gpsFromBowM: Math.round(along * 10) / 10,
		gpsFromCenterM: Math.round(off * 10) / 10
	};
}
function gpsReachM(boat) {
	return Math.hypot(boat.gpsFromBowM, boat.gpsFromCenterM);
}
/** Charted LAT depth to stay off the bottom. Not a sounder — draft, tide, and a small spare. */
function chartedDepthNeededM(draftM, tideLatM) {
	const spare = .4;
	return Math.max(spare, Math.round((draftM - tideLatM + spare) * 10) / 10);
}
function gpsStationLabel(boat) {
	const aft = boat.gpsFromBowM;
	const off = boat.gpsFromCenterM;
	const along = aft < .4 ? "at the bow" : aft > boat.loaM - .6 ? "at the stern" : `${aft.toFixed(1)} m aft of the bow`;
	if (Math.abs(off) < .3) return along;
	const side = off > 0 ? "starboard" : "port";
	return `${along}, ${Math.abs(off).toFixed(1)} m ${side}`;
}
function isLookMode(v) {
	return v === "normal" || v === "sunlight" || v === "night";
}
function nextLook(v) {
	if (v === "normal") return "sunlight";
	if (v === "sunlight") return "night";
	return "normal";
}
function isBoatFix(v) {
	if (!v || typeof v !== "object") return false;
	const f = v;
	return Number.isFinite(f.lat) && Number.isFinite(f.lng);
}
function isMobMark(v) {
	if (!v || typeof v !== "object") return false;
	const m = v;
	return Number.isFinite(m.lat) && Number.isFinite(m.lng);
}
function asLastKnown(fix) {
	return {
		...fix,
		source: "last",
		speedMs: 0
	};
}
function bowOf(fix, hull) {
	if (!fix) return null;
	return bowFromGps(fix, fix.heading, hull);
}
function watchRadius(rode, hull) {
	return rodeMath(rode, gpsReachM(hull)).radiusM;
}
function ghostHook(fix, hull, rode) {
	const bow = bowOf(fix, hull);
	if (!bow || !fix) return null;
	return hookAstern({
		...bow,
		heading: fix.heading
	}, rode);
}
var useHelm = create()(persist((set, get) => ({
	reefId: DEFAULT_REEF_ID,
	flyTo: null,
	boat: null,
	lastFix: null,
	followBoat: true,
	chartUp: "north",
	imagery: "auto",
	labels: true,
	seamarks: false,
	depths: false,
	panel: null,
	drawMode: "idle",
	draft: [],
	activePassage: null,
	anchor: null,
	alarmOn: false,
	alarmMuted: false,
	trackAlarm: false,
	gpsLost: false,
	steerSense: "cut",
	xteAlarmM: 25,
	demoPlaying: false,
	introOpen: false,
	drafts: [],
	gpsDenied: false,
	tapMode: "none",
	hookPreview: null,
	fenceDraft: [],
	chartZoom: 3,
	sunlight: false,
	look: "normal",
	sunPunch: 2,
	rode: DEFAULT_RODE,
	hull: DEFAULT_BOAT,
	alarmSound: "klaxon",
	wxHorizonH: 48,
	swingTrail: [],
	swingTrailOn: true,
	crumb: [],
	crumbOn: true,
	packDraft: [],
	packBox: null,
	offlinePacks: [],
	pinnedMark: null,
	mob: null,
	mobMuted: false,
	setReef: (id) => {
		const reef = getReef(id);
		set({
			reefId: id,
			flyTo: {
				lat: reef.lat,
				lng: reef.lng,
				zoom: reef.zoom,
				nonce: Date.now()
			},
			followBoat: false,
			panel: null
		});
	},
	fly: (lat, lng, zoom) => set({ flyTo: {
		lat,
		lng,
		zoom,
		nonce: Date.now()
	} }),
	setBoat: (fix) => {
		const keep = fix && (fix.source === "gps" || fix.source === "placed") ? fix : get().lastFix;
		let swingTrail = get().swingTrail;
		if (fix && get().anchor) swingTrail = appendSwingTrail(swingTrail, fix);
		let crumb = get().crumb;
		const moving = Boolean(fix && get().crumbOn && !get().anchor && (fix.speedMs >= .3 || get().drawMode === "record") && (fix.source === "gps" || fix.source === "demo"));
		if (fix && moving) crumb = appendTrail(crumb, fix);
		set({
			boat: fix,
			lastFix: keep,
			swingTrail,
			crumb
		});
	},
	setFollowBoat: (v) => set({ followBoat: v }),
	setChartUp: (chartUp) => set({ chartUp }),
	setImagery: (imagery) => set({ imagery }),
	setLabels: (labels) => set({ labels }),
	setSeamarks: (v) => set({ seamarks: v }),
	setDepths: (v) => set({ depths: v }),
	setPanel: (panel) => set({ panel }),
	setDrawMode: (drawMode) => {
		const s = get();
		set({
			drawMode,
			draft: drawMode === "record" && s.draft.length === 0 && s.boat ? [{
				lat: s.boat.lat,
				lng: s.boat.lng
			}] : s.draft,
			tapMode: drawMode === "draw" ? "none" : s.tapMode,
			followBoat: drawMode === "record" ? true : s.followBoat
		});
	},
	setDraft: (draft) => set({ draft }),
	appendDraft: (wp) => set({ draft: [...get().draft, wp] }),
	popDraft: () => set({ draft: get().draft.slice(0, -1) }),
	setActivePassage: (activePassage) => set({
		activePassage,
		pinnedMark: null,
		panel: null,
		flyTo: activePassage?.waypoints[0] ? {
			lat: activePassage.waypoints[0].lat,
			lng: activePassage.waypoints[0].lng,
			zoom: 18,
			nonce: Date.now()
		} : get().flyTo
	}),
	dropAnchor: (lat, lng, radiusM) => {
		const radius = radiusM ?? watchRadius(get().rode, get().hull);
		const boat = get().boat;
		set({
			anchor: {
				lat,
				lng,
				radiusM: radius,
				droppedAt: Date.now(),
				radiusLocked: false,
				fence: null
			},
			alarmOn: false,
			alarmMuted: false,
			panel: null,
			tapMode: "none",
			hookPreview: null,
			fenceDraft: [],
			swingTrail: boat ? [{
				lat: boat.lat,
				lng: boat.lng
			}] : [],
			swingTrailOn: get().swingTrailOn
		});
	},
	moveAnchor: (lat, lng) => {
		const a = get().anchor;
		if (!a) {
			get().dropAnchor(lat, lng);
			return;
		}
		set({
			anchor: {
				...a,
				lat,
				lng
			},
			hookPreview: null
		});
	},
	startPlaceHook: () => {
		const s = get();
		if (!s.boat) {
			set({
				tapMode: "place-boat",
				panel: null,
				hookPreview: null,
				fenceDraft: []
			});
			return;
		}
		set({
			tapMode: "drop-anchor",
			panel: null,
			followBoat: false,
			hookPreview: ghostHook(s.boat, s.hull, s.rode),
			fenceDraft: [],
			flyTo: {
				lat: s.boat.lat,
				lng: s.boat.lng,
				zoom: Math.max(s.chartZoom, HELM_ZOOM),
				nonce: Date.now()
			}
		});
	},
	cancelPlaceHook: () => set({
		tapMode: "none",
		hookPreview: null,
		fenceDraft: [],
		packDraft: []
	}),
	setHookPreview: (hookPreview) => set({ hookPreview }),
	setAnchorRadius: (radiusM, locked = true) => {
		const a = get().anchor;
		if (!a) return;
		set({ anchor: {
			...a,
			radiusM: clampAlarmRadius(radiusM),
			radiusLocked: locked
		} });
	},
	startResizeSwing: () => {
		if (!get().anchor) return;
		set({
			tapMode: "resize-swing",
			panel: null,
			followBoat: false,
			fenceDraft: []
		});
	},
	startDrawFence: () => {
		if (!get().anchor) return;
		set({
			tapMode: "draw-fence",
			panel: null,
			followBoat: false,
			fenceDraft: []
		});
	},
	appendFencePoint: (p) => set({ fenceDraft: [...get().fenceDraft, p] }),
	popFencePoint: () => set({ fenceDraft: get().fenceDraft.slice(0, -1) }),
	commitFence: () => {
		const a = get().anchor;
		const draft = get().fenceDraft;
		if (!a || draft.length < 3) return;
		set({
			anchor: {
				...a,
				fence: draft
			},
			fenceDraft: [],
			tapMode: "none"
		});
	},
	clearFence: () => {
		const a = get().anchor;
		if (!a) return;
		set({
			anchor: {
				...a,
				fence: null
			},
			fenceDraft: []
		});
	},
	weighAnchor: () => set({
		anchor: null,
		alarmOn: false,
		alarmMuted: false,
		gpsLost: false,
		panel: null,
		hookPreview: null,
		fenceDraft: [],
		tapMode: "none",
		swingTrail: []
	}),
	setAlarmOn: (alarmOn) => set({ alarmOn }),
	setAlarmMuted: (alarmMuted) => set({ alarmMuted }),
	setTrackAlarm: (trackAlarm) => set({ trackAlarm }),
	setGpsLost: (gpsLost) => set({ gpsLost }),
	setSteerSense: (steerSense) => set({ steerSense }),
	setXteAlarmM: (m) => set({ xteAlarmM: Math.max(0, Math.min(200, Math.round(m))) }),
	setDemoPlaying: (demoPlaying) => set({
		demoPlaying,
		followBoat: demoPlaying ? true : get().followBoat
	}),
	dismissIntro: () => set({ introOpen: false }),
	saveDraft: (input) => {
		const draft = {
			...input,
			localId: `local-${Date.now()}`,
			savedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		set({
			drafts: [draft, ...get().drafts].slice(0, 40),
			panel: null,
			drawMode: "idle",
			draft: []
		});
		return draft;
	},
	removeDraft: (localId) => set({ drafts: get().drafts.filter((d) => d.localId !== localId) }),
	setGpsDenied: (gpsDenied) => set({ gpsDenied }),
	setTapMode: (tapMode) => set({
		tapMode,
		drawMode: tapMode === "none" ? get().drawMode : "idle"
	}),
	setChartZoom: (chartZoom) => {
		if (get().chartZoom === chartZoom) return;
		set({ chartZoom });
	},
	setSunlight: (sunlight) => set({
		sunlight,
		look: sunlight ? "sunlight" : "normal"
	}),
	setLook: (look) => set({
		look,
		sunlight: look === "sunlight"
	}),
	cycleLook: () => {
		const look = nextLook(get().look);
		set({
			look,
			sunlight: look === "sunlight"
		});
	},
	setSunPunch: (sunPunch) => set({
		sunPunch,
		sunlight: true,
		look: "sunlight"
	}),
	setRode: (partial) => {
		const rode = clampRode({
			...get().rode,
			...partial
		}, get().rode);
		const hull = clampBoat({
			...get().hull,
			loaM: rode.loaM,
			bowM: rode.bowM
		});
		const a = get().anchor;
		const placing = get().tapMode === "drop-anchor";
		const boat = get().boat;
		set({
			rode,
			hull,
			anchor: a ? a.radiusLocked || a.fence && a.fence.length >= 3 ? a : {
				...a,
				radiusM: watchRadius(rode, hull)
			} : a,
			hookPreview: placing ? ghostHook(boat, hull, rode) : get().hookPreview
		});
	},
	setHull: (partial) => {
		const hull = clampBoat({
			...get().hull,
			...partial
		}, get().hull);
		const rode = clampRode({
			...get().rode,
			loaM: hull.loaM,
			bowM: hull.bowM
		});
		const a = get().anchor;
		const placing = get().tapMode === "drop-anchor";
		const boat = get().boat;
		set({
			hull,
			rode,
			anchor: a ? a.radiusLocked || a.fence && a.fence.length >= 3 ? a : {
				...a,
				radiusM: watchRadius(rode, hull)
			} : a,
			hookPreview: placing ? ghostHook(boat, hull, rode) : get().hookPreview
		});
	},
	setAlarmSound: (alarmSound) => set({ alarmSound }),
	setWxHorizonH: (h) => set({ wxHorizonH: clampWxHorizon(h) }),
	setSwingTrailOn: (swingTrailOn) => set({ swingTrailOn }),
	setCrumbOn: (crumbOn) => set({ crumbOn }),
	clearCrumb: () => set({ crumb: [] }),
	reverseTrack: () => {
		const s = get();
		const fromDraft = s.drawMode !== "idle" && s.draft.length >= 2;
		const fromPassage = Boolean(!fromDraft && s.activePassage && s.activePassage.waypoints.length >= 2);
		const src = fromDraft ? s.draft : fromPassage ? s.activePassage.waypoints : s.crumb;
		if (src.length < 2) return false;
		const waypoints = reverseWaypoints(src);
		const title = fromPassage ? s.activePassage.title.endsWith("· back") ? s.activePassage.title.replace(/\s· back$/, "") : `${s.activePassage.title} · back` : "Back out";
		set({
			activePassage: {
				localId: `back-${Date.now()}`,
				title,
				region: s.activePassage?.region ?? "",
				notes: "Reversed GPS trail — same water out.",
				kind: "passage",
				waypoints,
				savedAt: (/* @__PURE__ */ new Date()).toISOString()
			},
			drawMode: "idle",
			followBoat: true,
			chartUp: "heading",
			panel: null
		});
		return true;
	},
	startDrawPack: () => set({
		tapMode: "draw-pack",
		packDraft: [],
		panel: null,
		followBoat: false
	}),
	appendPackCorner: (p) => {
		const d = get().packDraft;
		if (d.length === 0) {
			set({ packDraft: [p] });
			return;
		}
		set({
			packBox: boxFromCorners(d[0], p),
			packDraft: [],
			tapMode: "none",
			panel: "layers"
		});
	},
	popPackCorner: () => set({ packDraft: get().packDraft.slice(0, -1) }),
	clearPackBox: () => set({
		packBox: null,
		packDraft: [],
		tapMode: "none"
	}),
	setPackBox: (packBox) => set({ packBox }),
	setOfflinePacks: (offlinePacks) => set({ offlinePacks }),
	setPinnedMark: (pinnedMark) => set({ pinnedMark }),
	dropMob: () => {
		const boat = get().boat;
		if (!boat) return false;
		set({
			mob: {
				lat: boat.lat,
				lng: boat.lng,
				at: Date.now()
			},
			mobMuted: false,
			panel: null
		});
		return true;
	},
	clearMob: () => set({
		mob: null,
		mobMuted: false
	}),
	setMobMuted: (mobMuted) => set({ mobMuted })
}), {
	name: "reefpilot-helm-v8",
	partialize: (s) => ({
		imagery: s.imagery,
		labels: s.labels,
		seamarks: s.seamarks,
		depths: s.depths,
		sunlight: s.sunlight,
		look: s.look,
		sunPunch: s.sunPunch,
		drafts: s.drafts,
		lastFix: s.lastFix,
		rode: s.rode,
		hull: s.hull,
		chartUp: s.chartUp,
		steerSense: s.steerSense,
		xteAlarmM: s.xteAlarmM,
		alarmSound: s.alarmSound,
		wxHorizonH: s.wxHorizonH,
		swingTrailOn: s.swingTrailOn,
		crumb: s.crumb,
		crumbOn: s.crumbOn,
		mob: s.mob
	}),
	merge: (persisted, current) => {
		const p = persisted ?? {};
		const last = isBoatFix(p.lastFix) ? p.lastFix : current.lastFix;
		const boat = last ? asLastKnown(last) : null;
		const rode = clampRode({
			...current.rode,
			...p.rode ?? {}
		});
		const hull = clampBoat({
			...current.hull,
			...p.hull ?? {},
			loaM: p.hull?.loaM ?? rode.loaM,
			bowM: p.hull?.bowM ?? rode.bowM
		});
		return {
			...current,
			...p,
			imagery: isImageryId(p.imagery) ? p.imagery : current.imagery,
			depths: typeof p.depths === "boolean" ? p.depths : current.depths,
			look: isLookMode(p.look) ? p.look : p.sunlight === true ? "sunlight" : current.look,
			sunlight: isLookMode(p.look) ? p.look === "sunlight" : typeof p.sunlight === "boolean" ? p.sunlight : current.sunlight,
			sunPunch: p.sunPunch === 1 || p.sunPunch === 2 || p.sunPunch === 3 ? p.sunPunch : current.sunPunch,
			rode: clampRode({
				...rode,
				loaM: hull.loaM,
				bowM: hull.bowM
			}),
			hull,
			chartUp: isChartUp(p.chartUp) ? p.chartUp : current.chartUp,
			steerSense: isSteerSense(p.steerSense) ? p.steerSense : current.steerSense,
			xteAlarmM: typeof p.xteAlarmM === "number" && Number.isFinite(p.xteAlarmM) ? Math.max(0, Math.min(200, Math.round(p.xteAlarmM))) : current.xteAlarmM,
			wxHorizonH: typeof p.wxHorizonH === "number" ? clampWxHorizon(p.wxHorizonH) : current.wxHorizonH,
			swingTrailOn: typeof p.swingTrailOn === "boolean" ? p.swingTrailOn : current.swingTrailOn,
			crumbOn: typeof p.crumbOn === "boolean" ? p.crumbOn : current.crumbOn,
			crumb: Array.isArray(p.crumb) ? p.crumb.filter((pt) => Boolean(pt) && typeof pt === "object" && Number.isFinite(pt.lat) && Number.isFinite(pt.lng)) : current.crumb,
			mob: isMobMark(p.mob) ? p.mob : null,
			alarmSound: isAlarmSound(p.alarmSound) ? p.alarmSound : current.alarmSound,
			introOpen: false,
			panel: null,
			tapMode: "none",
			swingTrail: [],
			followBoat: true,
			lastFix: last,
			boat,
			flyTo: boat ? {
				lat: boat.lat,
				lng: boat.lng,
				zoom: HELM_ZOOM,
				nonce: 1
			} : null,
			chartZoom: boat ? HELM_ZOOM : 3
		};
	}
}));
function passagePoints(p) {
	return p.waypoints.map((w) => ({
		lat: w.lat,
		lng: w.lng
	}));
}
function useHelmLocation() {
	return useHelm((s) => {
		if (s.anchor) return s.anchor;
		if (s.followBoat && s.boat) return s.boat;
		if (s.flyTo) return s.flyTo;
		return s.boat ?? s.lastFix ?? getReef(s.reefId);
	});
}
function useWx() {
	const loc = useHelmLocation();
	const key = loc ? wxLocKey(loc.lat, loc.lng) : "";
	return useQuery({
		queryKey: [
			"wx",
			key,
			"d16"
		],
		queryFn: () => fetchWeather(loc.lat, loc.lng),
		enabled: Boolean(loc),
		staleTime: 12e5,
		retry: 1
	});
}
function cssVar(name, fallback) {
	if (typeof window === "undefined") return fallback;
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function boatHtml(heading, size, gpsX, gpsY) {
	return `<div class="rp-boat" style="width:${size}px;height:${size}px;transform:rotate(${Number.isFinite(heading) ? heading : 0}deg);transform-origin:${gpsX}px ${gpsY}px">
    <svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
      <path class="rp-boat-hull" d="M20 2 L32 34 L20 28 L8 34 Z"/>
      <circle class="rp-boat-gps" cx="${gpsX / size * 40}" cy="${gpsY / size * 40}" r="2.4"/>
    </svg>
  </div>`;
}
function loaPixels(lat, zoom, loaM, sun) {
	const mPerPx = 40075016.686 * Math.cos(lat * Math.PI / 180) / (256 * 2 ** zoom);
	const px = loaM / Math.max(mPerPx, .08);
	return Math.round(Math.min(160, Math.max(sun ? 48 : 36, px)));
}
function gpsAnchorPx(size, hull) {
	const gpsY = Math.max(3, Math.min(size - 3, hull.gpsFromBowM / Math.max(1, hull.loaM) * size));
	return {
		gpsX: size / 2 + hull.gpsFromCenterM / Math.max(.4, hull.beamM) * (size * .28),
		gpsY
	};
}
function pinHtml(kind, label, next) {
	if (kind === "anchor") return `<div class="rp-pin rp-pin-anchor"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2a3 3 0 0 1 1 5.83V11h3v2h-3.1A6.5 6.5 0 0 1 18 19h-2a4.5 6.5 0 0 0-8 0H6a6.5 6.5 0 0 1 5.1-6H8v-2h3V7.83A3 3 0 0 1 12 2Z"/></svg></div>`;
	if (kind === "rim") return `<div class="rp-rim"></div>`;
	return `<div class="rp-pin rp-pin-wp${next ? " rp-pin-next" : ""}">${label ?? ""}</div>`;
}
function closeInOnBoat() {
	window.dispatchEvent(new CustomEvent("rp-close-in"));
}
var paintSeaSet = null;
function setSeaSetOverlay(v) {
	paintSeaSet?.(v);
}
var TRANSPARENT_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
function leafletFrom(mod) {
	const m = mod;
	if (typeof m.TileLayer === "function" && typeof m.map === "function") return m;
	if (typeof m.default?.TileLayer === "function" && typeof m.default.map === "function") return m.default;
	if (typeof m.default?.default?.TileLayer === "function") return m.default.default;
	throw new Error("Leaflet TileLayer missing");
}
function loadSatTile(tile, src, done, cacheKey) {
	const ok = () => done(void 0, tile);
	const blank = () => {
		tile.src = TRANSPARENT_GIF;
		tile.onload = ok;
	};
	const paintBlob = (blob) => {
		if (blob.size < 3200) {
			blank();
			return;
		}
		const obj = URL.createObjectURL(blob);
		tile.dataset.blob = obj;
		tile.onload = ok;
		tile.onerror = blank;
		tile.src = obj;
	};
	(async () => {
		if (cacheKey) {
			const hit = await readTile(cacheKey);
			if (hit) {
				paintBlob(hit);
				return;
			}
		}
		try {
			const r = await fetch(src, { mode: "cors" });
			if (!r.ok) throw new Error("missing");
			paintBlob(await r.blob());
		} catch {
			tile.onload = ok;
			tile.onerror = blank;
			tile.src = src;
		}
	})();
}
function satLayer(L, url, opts) {
	const options = {
		maxZoom: 22,
		maxNativeZoom: opts.maxNativeZoom,
		minZoom: 3,
		detectRetina: false,
		keepBuffer: 6,
		updateWhenIdle: false,
		updateWhenZooming: true,
		attribution: opts.attribution,
		errorTileUrl: TRANSPARENT_GIF,
		opacity: opts.opacity ?? 1,
		className: "rp-sat-tile"
	};
	if (opts.pane) options.pane = opts.pane;
	if (opts.subdomains) options.subdomains = opts.subdomains;
	if (!opts.skipStubs && !opts.tileUrl) return L.tileLayer(url, options);
	const proto = {};
	if (opts.tileUrl) {
		const custom = opts.tileUrl;
		proto.getTileUrl = function(coords) {
			return custom(coords);
		};
	}
	if (opts.skipStubs || opts.cacheSource) proto.createTile = function(coords, done) {
		const tile = document.createElement("img");
		tile.alt = "";
		tile.setAttribute("role", "presentation");
		const key = opts.cacheSource ? `${opts.cacheSource}/${coords.z}/${coords.x}/${coords.y}` : void 0;
		loadSatTile(tile, this.getTileUrl(coords), done, key);
		return tile;
	};
	const layer = new (L.TileLayer.extend(proto))(url, options);
	layer.on("tileunload", (e) => {
		const blob = e.tile.dataset.blob;
		if (blob) URL.revokeObjectURL(blob);
	});
	return layer;
}
function MapView() {
	const hostRef = (0, import_react.useRef)(null);
	const wx = useWx();
	const boat = useHelm((s) => s.boat ?? s.lastFix);
	const chartUp = useHelm((s) => s.chartUp);
	(0, import_react.useEffect)(() => {
		const sea = wx.data?.sea;
		if (!boat || sea?.currentKn == null || sea.currentDir == null || sea.currentKn < .2) {
			setSeaSetOverlay(null);
			return;
		}
		const screen = sea.currentDir - chartBearing(chartUp, boat.heading);
		setSeaSetOverlay({
			lat: boat.lat,
			lng: boat.lng,
			kn: sea.currentKn,
			screenDeg: screen
		});
	}, [
		wx.data,
		boat,
		chartUp
	]);
	(0, import_react.useEffect)(() => {
		if (!hostRef.current) return;
		let cancelled = false;
		let map = null;
		let unsub = () => {};
		import("../_libs/leaflet.mjs").then((n) => /* @__PURE__ */ __toESM(n.t())).then(async (mod) => {
			if (cancelled || !hostRef.current) return;
			const L = leafletFrom(mod);
			window.L = L;
			await import("../_libs/leaflet-rotate.mjs").then((n) => n.t);
			if (cancelled || !hostRef.current) return;
			const primary = cssVar("--color-primary", "#3ee0c0");
			const danger = cssVar("--color-destructive", "#ff5a6a");
			const fg = cssVar("--color-foreground", "#e6f3ef");
			const sunMark = cssVar("--color-sun-mark", "#f4fff8");
			const sunInk = cssVar("--color-sun-ink", "#041016");
			map = L.map(hostRef.current, {
				zoomControl: false,
				attributionControl: true,
				maxZoom: 22,
				minZoom: 3,
				worldCopyJump: false,
				zoomSnap: .25,
				zoomDelta: .5,
				fadeAnimation: true,
				zoomAnimation: true,
				dragging: true,
				tapTolerance: 20,
				inertia: true,
				inertiaDeceleration: 1800,
				bounceAtZoomLimits: false,
				rotate: true,
				rotateControl: false,
				bearing: 0,
				touchRotate: false,
				shiftKeyRotate: false,
				compassBearing: false
			});
			const mapDrag = map.dragging;
			if (mapDrag._draggable) mapDrag._draggable.options.clickTolerance = 1;
			const rotatePane = map.getPane("rotatePane") ?? map.getPane("mapPane");
			map.createPane("satOverlay", rotatePane);
			const overlayPane = map.getPane("satOverlay");
			if (overlayPane) overlayPane.style.zIndex = "250";
			map.createPane("satHi", rotatePane);
			const hiPane = map.getPane("satHi");
			if (hiPane) hiPane.style.zIndex = "260";
			map.createPane("chartOverlay", rotatePane);
			const chartPane = map.getPane("chartOverlay");
			if (chartPane) chartPane.style.zIndex = "270";
			const sentinel = satLayer(L, SENTINEL_URL, {
				maxNativeZoom: 18,
				attribution: ATTR_SENTINEL,
				skipStubs: true,
				cacheSource: "sentinel"
			});
			const esri = satLayer(L, ESRI_URL, {
				maxNativeZoom: 18,
				attribution: ATTR_ESRI,
				skipStubs: true,
				pane: "satOverlay",
				cacheSource: "maxar"
			});
			const clarity = satLayer(L, CLARITY_URL, {
				maxNativeZoom: 18,
				attribution: ATTR_ESRI,
				skipStubs: true,
				pane: "satOverlay"
			});
			const bing = satLayer(L, "", {
				maxNativeZoom: 19,
				attribution: ATTR_BING,
				skipStubs: true,
				pane: "satOverlay",
				tileUrl: (c) => bingTileUrl(c.x, c.y, c.z)
			});
			const google = satLayer(L, GOOGLE_URL, {
				maxNativeZoom: 21,
				attribution: ATTR_GOOGLE,
				pane: "satHi",
				subdomains: "0123"
			});
			const labels = L.tileLayer(LABELS_URL, {
				maxZoom: 22,
				maxNativeZoom: 19,
				detectRetina: false,
				opacity: .9,
				pane: "satHi"
			});
			const sea = L.tileLayer(SEAMARK_URL, {
				maxZoom: 18,
				opacity: .95,
				pane: "chartOverlay",
				attribution: ATTR_OPENSEAMAP
			});
			const depths = L.tileLayer.wms(DEPTH_WMS_URL, {
				layers: DEPTH_WMS_LAYERS,
				format: "image/png",
				transparent: true,
				version: "1.1.0",
				maxZoom: 22,
				opacity: .85,
				pane: "chartOverlay",
				attribution: ATTR_OPENSEAMAP
			});
			L.control.scale({
				metric: true,
				imperial: false,
				position: "bottomright"
			}).addTo(map);
			const boatIcon = (heading, sun, hull, lat, zoom) => {
				const size = loaPixels(lat, zoom, hull.loaM, sun);
				const { gpsX, gpsY } = gpsAnchorPx(size, hull);
				return L.divIcon({
					className: "rp-divicon",
					html: boatHtml(heading, size, gpsX, gpsY),
					iconSize: [size, size],
					iconAnchor: [gpsX, gpsY]
				});
			};
			const boatMarker = L.marker([-23.8918, 152.3842], {
				icon: boatIcon(125, false, useHelm.getState().hull, -23.8918, HELM_ZOOM),
				zIndexOffset: 800,
				keyboard: false,
				interactive: false
			});
			const setMarker = L.marker([-23.8918, 152.3842], {
				icon: L.divIcon({
					className: "rp-divicon",
					html: `<div class="rp-set"></div>`,
					iconSize: [28, 28],
					iconAnchor: [14, 14]
				}),
				zIndexOffset: 750,
				keyboard: false,
				interactive: false
			});
			let setOn = false;
			paintSeaSet = (v) => {
				if (!map) return;
				if (!v || v.kn < .2) {
					if (setOn) {
						map.removeLayer(setMarker);
						setOn = false;
					}
					return;
				}
				setMarker.setLatLng([v.lat, v.lng]);
				setMarker.setIcon(L.divIcon({
					className: "rp-divicon",
					html: `<div class="rp-set" style="transform:rotate(${v.screenDeg}deg)"><svg viewBox="0 0 24 32" width="22" height="28"><path d="M12 2 L20 18 L14 18 L14 30 L10 30 L10 18 L4 18 Z"/></svg></div>`,
					iconSize: [28, 28],
					iconAnchor: [14, 14]
				}));
				if (!setOn) {
					setMarker.addTo(map);
					setOn = true;
				}
			};
			const accCircle = L.circle([-23.8918, 152.3842], {
				radius: 8,
				color: primary,
				weight: 1,
				fillColor: primary,
				fillOpacity: .12,
				interactive: false
			});
			const anchorCircle = L.circle([0, 0], {
				radius: 40,
				color: primary,
				weight: 2,
				dashArray: "6 8",
				fillColor: primary,
				fillOpacity: .08,
				interactive: false
			});
			const alarmCircle = L.circle([0, 0], {
				radius: 40,
				color: danger,
				weight: 3,
				fillColor: danger,
				fillOpacity: .18,
				interactive: false
			});
			const laybackCircle = L.circle([0, 0], {
				radius: 30,
				color: primary,
				weight: 2,
				dashArray: "2 10",
				fillColor: primary,
				fillOpacity: .04,
				interactive: false
			});
			const rodeLine = L.polyline([], {
				color: primary,
				weight: 3,
				dashArray: "5 7",
				opacity: .95,
				interactive: false
			});
			const hookGhost = L.marker([0, 0], {
				icon: L.divIcon({
					className: "rp-divicon",
					html: pinHtml("anchor"),
					iconSize: [28, 28],
					iconAnchor: [14, 14]
				}),
				interactive: false,
				opacity: .75,
				zIndexOffset: 550
			});
			const anchorMarker = L.marker([0, 0], {
				icon: L.divIcon({
					className: "rp-divicon",
					html: pinHtml("anchor"),
					iconSize: [28, 28],
					iconAnchor: [14, 14]
				}),
				draggable: true,
				autoPan: true,
				zIndexOffset: 500
			});
			const rimHandle = L.marker([0, 0], {
				icon: L.divIcon({
					className: "rp-divicon",
					html: pinHtml("rim"),
					iconSize: [22, 22],
					iconAnchor: [11, 11]
				}),
				draggable: true,
				autoPan: false,
				zIndexOffset: 520
			});
			const fencePoly = L.polygon([], {
				color: primary,
				weight: 3,
				fillColor: primary,
				fillOpacity: .08,
				interactive: false
			});
			const fenceDraftLine = L.polyline([], {
				color: primary,
				weight: 3,
				dashArray: "6 6",
				interactive: false
			});
			const fenceGroup = L.layerGroup();
			const rangeLine = L.polyline([], {
				color: primary,
				weight: 2,
				dashArray: "4 8",
				opacity: .95,
				interactive: false
			});
			const routeLine = L.polyline([], {
				color: primary,
				weight: 4,
				opacity: .95,
				lineJoin: "round",
				lineCap: "round"
			});
			const routeGlow = L.polyline([], {
				color: fg,
				weight: 8,
				opacity: .22,
				lineJoin: "round"
			});
			const draftLine = L.polyline([], {
				color: primary,
				weight: 3,
				dashArray: "7 8",
				opacity: .9
			});
			const swingLine = L.polyline([], {
				color: primary,
				weight: 2.5,
				opacity: .9,
				lineJoin: "round",
				lineCap: "round"
			});
			const crumbLine = L.polyline([], {
				color: "#f0c14a",
				weight: 3,
				opacity: .85,
				lineJoin: "round",
				lineCap: "round"
			});
			const mobLine = L.polyline([], {
				color: danger,
				weight: 3,
				dashArray: "3 7",
				opacity: .95,
				interactive: false
			});
			const mobMarker = L.marker([0, 0], {
				icon: L.divIcon({
					className: "rp-divicon",
					html: `<div class="rp-pin rp-pin-mob">MOB</div>`,
					iconSize: [36, 36],
					iconAnchor: [18, 18]
				}),
				interactive: false,
				zIndexOffset: 900
			});
			const packDraftRect = L.rectangle([[0, 0], [0, 0]], {
				color: "#3ee0c0",
				weight: 2,
				dashArray: "6 5",
				fillOpacity: .08,
				interactive: false
			});
			const packGroup = L.layerGroup();
			const wpGroup = L.layerGroup();
			routeGlow.addTo(map);
			routeLine.addTo(map);
			rangeLine.addTo(map);
			draftLine.addTo(map);
			swingLine.addTo(map);
			crumbLine.addTo(map);
			packGroup.addTo(map);
			wpGroup.addTo(map);
			fenceGroup.addTo(map);
			const start = useHelm.getState();
			const origin = start.boat ?? start.flyTo;
			map.setView(origin ? [origin.lat, origin.lng] : [0, 20], origin ? Math.max(start.flyTo?.zoom ?? 19.5, HELM_ZOOM) : 3);
			useHelm.getState().setChartZoom(map.getZoom());
			let lastFly = 0;
			let labelsOn = false;
			let seaOn = false;
			let depthsOn = false;
			let anchorOn = false;
			let alarmShown = false;
			let followArmed = false;
			let boatOn = false;
			let laybackOn = false;
			let rodeOn = false;
			let ghostOn = false;
			let hookDragging = false;
			let rimDragging = false;
			let rimOn = false;
			let fenceOn = false;
			let fenceDraftOn = false;
			let mobOn = false;
			let currentImagery = "";
			let displayBearing = 0;
			let applying = false;
			const setMapBearing = (deg) => {
				const m = map;
				if (typeof m.setBearing !== "function") return;
				const cur = m.getBearing?.() ?? 0;
				const d = (deg - cur + 540) % 360 - 180;
				if (Math.abs(d) < .35 && !(deg === 0 && Math.abs(cur) > .35)) return;
				m.setBearing(deg);
			};
			const satOn = (layer, on) => {
				if (!map) return;
				const has = map.hasLayer(layer);
				if (on && !has) layer.addTo(map);
				if (!on && has) map.removeLayer(layer);
			};
			const applyImagery = (id) => {
				if (id === currentImagery) return;
				currentImagery = id;
				satOn(sentinel, true);
				satOn(esri, id === "auto" || id === "maxar");
				satOn(clarity, id === "clarity");
				satOn(bing, id === "bing");
				satOn(google, id === "auto" || id === "google");
			};
			const paintWaypoints = (wps, nextI) => {
				wpGroup.clearLayers();
				wps.forEach((w, i) => {
					const next = nextI === i;
					const mk = L.marker([w.lat, w.lng], {
						icon: L.divIcon({
							className: "rp-divicon",
							html: pinHtml("wp", String(i + 1), next),
							iconSize: next ? [28, 28] : [22, 22],
							iconAnchor: next ? [14, 14] : [11, 11]
						}),
						interactive: true,
						keyboard: false,
						zIndexOffset: next ? 400 : 200
					});
					mk.on("click", (ev) => {
						L.DomEvent.stop(ev);
						const st = useHelm.getState();
						st.setPinnedMark(st.pinnedMark === i ? null : i);
					});
					mk.addTo(wpGroup);
				});
			};
			const apply = () => {
				if (!map || applying) return;
				applying = true;
				try {
					const s = useHelm.getState();
					applyImagery(s.imagery);
					const look = s.look;
					const sun = look === "sunlight";
					const night = look === "night";
					routeLine.setStyle({
						color: sun ? sunMark : night ? "#ff6a2a" : primary,
						weight: sun ? 6 : 4,
						opacity: .98
					});
					routeGlow.setStyle({
						color: sun ? sunInk : night ? "#3a1208" : fg,
						weight: sun ? 14 : 8,
						opacity: sun ? .92 : night ? .55 : .22
					});
					draftLine.setStyle({
						color: sun ? sunMark : primary,
						weight: sun ? 5 : 3,
						opacity: .95
					});
					swingLine.setStyle({
						color: sun ? sunMark : "#f0c14a",
						weight: sun ? 4 : 2.5,
						opacity: .95
					});
					rodeLine.setStyle({
						color: sun ? sunMark : primary,
						weight: sun ? 4 : 3
					});
					fencePoly.setStyle({
						color: sun ? sunMark : primary,
						fillColor: sun ? sunMark : primary
					});
					fenceDraftLine.setStyle({ color: sun ? sunMark : primary });
					laybackCircle.setStyle({
						color: sun ? sunMark : primary,
						fillColor: sun ? sunMark : primary
					});
					accCircle.setStyle({
						color: sun ? sunMark : primary,
						fillColor: sun ? sunMark : primary,
						weight: sun ? 2 : 1,
						fillOpacity: sun ? .18 : .12
					});
					anchorCircle.setStyle({
						color: sun ? sunMark : primary,
						fillColor: sun ? sunMark : primary,
						weight: sun ? 3 : 2
					});
					if (s.labels) {
						if (!labelsOn) {
							labels.addTo(map);
							labelsOn = true;
						}
					} else if (labelsOn) {
						map.removeLayer(labels);
						labelsOn = false;
					}
					if (s.seamarks) {
						if (!seaOn) {
							sea.addTo(map);
							seaOn = true;
						}
					} else if (seaOn) {
						map.removeLayer(sea);
						seaOn = false;
					}
					if (s.depths) {
						if (!depthsOn) {
							depths.addTo(map);
							depthsOn = true;
						}
					} else if (depthsOn) {
						map.removeLayer(depths);
						depthsOn = false;
					}
					if (s.flyTo && s.flyTo.nonce !== lastFly) {
						lastFly = s.flyTo.nonce;
						const z = s.followBoat ? Math.max(s.flyTo.zoom, HELM_ZOOM) : s.flyTo.zoom;
						map.flyTo([s.flyTo.lat, s.flyTo.lng], z, { duration: 1.05 });
					}
					const wantBearing = chartBearing(s.chartUp, s.boat?.heading ?? null);
					displayBearing = lerpBearing(displayBearing, wantBearing, .28);
					if (wantBearing === 0 && (displayBearing < .5 || displayBearing > 359.5)) displayBearing = 0;
					setMapBearing(displayBearing);
					if (s.boat) {
						boatMarker.setLatLng([s.boat.lat, s.boat.lng]);
						boatMarker.setIcon(boatIcon(hullScreenHeading(s.chartUp, s.boat.heading), s.sunlight, s.hull, s.boat.lat, map.getZoom()));
						accCircle.setLatLng([s.boat.lat, s.boat.lng]);
						accCircle.setRadius(Math.max(4, s.boat.accuracy ?? 6));
						if (!boatOn) {
							accCircle.addTo(map);
							boatMarker.addTo(map);
							boatOn = true;
						}
						if (s.followBoat && !mapDrag.moving?.()) {
							if (!followArmed) {
								followArmed = true;
								map.setView([s.boat.lat, s.boat.lng], Math.max(map.getZoom(), HELM_ZOOM), { animate: true });
							} else map.panTo([s.boat.lat, s.boat.lng], {
								animate: true,
								duration: .35
							});
						} else followArmed = false;
					} else if (boatOn) {
						map.removeLayer(boatMarker);
						map.removeLayer(accCircle);
						boatOn = false;
						followArmed = false;
					}
					const placing = s.tapMode === "drop-anchor";
					const resizing = s.tapMode === "resize-swing";
					if (placing || resizing) {
						if (map.dragging.enabled()) map.dragging.disable();
					} else if (!hookDragging && !rimDragging && !map.dragging.enabled()) map.dragging.enable();
					const bow = s.boat ? bowFromGps(s.boat, s.boat.heading, s.hull) : null;
					const hookAt = placing ? s.hookPreview : s.anchor;
					if (bow && placing) {
						const lay = Math.max(8, laybackM(s.rode));
						laybackCircle.setLatLng([bow.lat, bow.lng]);
						laybackCircle.setRadius(lay);
						if (!laybackOn) {
							laybackCircle.addTo(map);
							laybackOn = true;
						}
					} else if (laybackOn) {
						map.removeLayer(laybackCircle);
						laybackOn = false;
					}
					if (bow && hookAt) {
						rodeLine.setLatLngs([[bow.lat, bow.lng], [hookAt.lat, hookAt.lng]]);
						if (!rodeOn) {
							rodeLine.addTo(map);
							rodeOn = true;
						}
					} else if (rodeOn) {
						rodeLine.setLatLngs([]);
						map.removeLayer(rodeLine);
						rodeOn = false;
					}
					if (placing && s.hookPreview) {
						hookGhost.setLatLng([s.hookPreview.lat, s.hookPreview.lng]);
						if (!ghostOn) {
							hookGhost.addTo(map);
							ghostOn = true;
						}
					} else if (ghostOn) {
						map.removeLayer(hookGhost);
						ghostOn = false;
					}
					const pts = s.activePassage ? passagePoints(s.activePassage) : [];
					const wps = s.drawMode !== "idle" ? s.draft : s.activePassage?.waypoints ?? [];
					const nav = s.boat && wps.length >= 1 ? markNav(s.boat, wps, s.pinnedMark) : null;
					routeLine.setLatLngs(pts.map((p) => [p.lat, p.lng]));
					routeGlow.setLatLngs(pts.map((p) => [p.lat, p.lng]));
					paintWaypoints(wps, nav?.index ?? null);
					if (s.boat && nav) {
						const mark = wps[nav.index];
						rangeLine.setLatLngs([[s.boat.lat, s.boat.lng], [mark.lat, mark.lng]]);
					} else rangeLine.setLatLngs([]);
					draftLine.setLatLngs(s.draft.map((p) => [p.lat, p.lng]));
					if (s.anchor && s.swingTrailOn && s.swingTrail.length >= 2) swingLine.setLatLngs(s.swingTrail.map((p) => [p.lat, p.lng]));
					else swingLine.setLatLngs([]);
					if (!s.anchor && s.crumbOn && s.crumb.length >= 2) crumbLine.setLatLngs(s.crumb.map((p) => [p.lat, p.lng]));
					else crumbLine.setLatLngs([]);
					if (s.mob) {
						mobMarker.setLatLng([s.mob.lat, s.mob.lng]);
						if (s.boat) mobLine.setLatLngs([[s.boat.lat, s.boat.lng], [s.mob.lat, s.mob.lng]]);
						else mobLine.setLatLngs([]);
						if (!mobOn) {
							mobMarker.addTo(map);
							mobLine.addTo(map);
							mobOn = true;
						}
					} else if (mobOn) {
						map.removeLayer(mobMarker);
						map.removeLayer(mobLine);
						mobOn = false;
					}
					packGroup.clearLayers();
					for (const pack of s.offlinePacks) L.rectangle([[pack.bounds.south, pack.bounds.west], [pack.bounds.north, pack.bounds.east]], {
						color: "#22c55e",
						weight: 2,
						fillColor: "#22c55e",
						fillOpacity: .08,
						interactive: false
					}).addTo(packGroup);
					if (s.packBox) L.rectangle([[s.packBox.south, s.packBox.west], [s.packBox.north, s.packBox.east]], {
						color: "#3ee0c0",
						weight: 2,
						dashArray: "5 4",
						fillOpacity: .1,
						interactive: false
					}).addTo(packGroup);
					if (s.tapMode === "draw-pack" && s.packDraft.length === 1) {
						const a = s.packDraft[0];
						packDraftRect.setBounds([[a.lat - 5e-5, a.lng - 5e-5], [a.lat + 5e-5, a.lng + 5e-5]]);
						if (!map.hasLayer(packDraftRect)) packDraftRect.addTo(map);
					} else if (map.hasLayer(packDraftRect)) map.removeLayer(packDraftRect);
					if (s.anchor && !placing) {
						anchorCircle.setLatLng([s.anchor.lat, s.anchor.lng]);
						anchorCircle.setRadius(s.anchor.radiusM);
						alarmCircle.setLatLng([s.anchor.lat, s.anchor.lng]);
						alarmCircle.setRadius(s.anchor.radiusM);
						if (!hookDragging) anchorMarker.setLatLng([s.anchor.lat, s.anchor.lng]);
						if (!anchorOn) {
							anchorCircle.addTo(map);
							anchorMarker.addTo(map);
							anchorOn = true;
						}
						const fenced = Boolean(s.anchor.fence && s.anchor.fence.length >= 3);
						if (s.alarmOn && !fenced && !alarmShown) {
							alarmCircle.addTo(map);
							alarmShown = true;
						} else if ((!s.alarmOn || fenced) && alarmShown) {
							map.removeLayer(alarmCircle);
							alarmShown = false;
						}
						if (!rimDragging && !fenced) {
							const brg = s.boat ? bearingDegrees(s.anchor, s.boat) : 0;
							const rim = destPoint(s.anchor, brg, s.anchor.radiusM);
							rimHandle.setLatLng([rim.lat, rim.lng]);
							if (!rimOn) {
								rimHandle.addTo(map);
								rimOn = true;
							}
						} else if (fenced && rimOn) {
							map.removeLayer(rimHandle);
							rimOn = false;
						}
						if (fenced) {
							fencePoly.setLatLngs(s.anchor.fence.map((p) => [p.lat, p.lng]));
							fencePoly.setStyle({
								color: s.alarmOn ? danger : sun ? sunMark : primary,
								fillColor: s.alarmOn ? danger : sun ? sunMark : primary,
								fillOpacity: s.alarmOn ? .2 : .14,
								weight: 3
							});
							if (!fenceOn) {
								fencePoly.addTo(map);
								fenceOn = true;
							}
						} else if (fenceOn) {
							map.removeLayer(fencePoly);
							fenceOn = false;
						}
					} else if (anchorOn) {
						map.removeLayer(anchorCircle);
						map.removeLayer(anchorMarker);
						if (alarmShown) map.removeLayer(alarmCircle);
						if (rimOn) map.removeLayer(rimHandle);
						if (fenceOn) map.removeLayer(fencePoly);
						anchorOn = false;
						alarmShown = false;
						rimOn = false;
						fenceOn = false;
					}
					if (s.tapMode === "draw-fence") {
						const d = s.fenceDraft;
						fenceDraftLine.setLatLngs(d.map((p) => [p.lat, p.lng]));
						if (!fenceDraftOn) {
							fenceDraftLine.addTo(map);
							fenceDraftOn = true;
						}
						fenceGroup.clearLayers();
						d.forEach((p, i) => {
							L.marker([p.lat, p.lng], {
								icon: L.divIcon({
									className: "rp-divicon",
									html: pinHtml("wp", String(i + 1)),
									iconSize: [22, 22],
									iconAnchor: [11, 11]
								}),
								interactive: false,
								keyboard: false
							}).addTo(fenceGroup);
						});
					} else if (fenceDraftOn) {
						fenceDraftLine.setLatLngs([]);
						map.removeLayer(fenceDraftLine);
						fenceGroup.clearLayers();
						fenceDraftOn = false;
					}
				} finally {
					applying = false;
				}
			};
			apply();
			unsub = useHelm.subscribe(apply);
			map.on("click", (e) => {
				const s = useHelm.getState();
				const wp = {
					lat: e.latlng.lat,
					lng: e.latlng.lng
				};
				if (s.drawMode === "draw") {
					s.appendDraft({
						...wp,
						label: `WP ${s.draft.length + 1}`
					});
					return;
				}
				if (s.tapMode === "place-boat") {
					s.setBoat({
						lat: wp.lat,
						lng: wp.lng,
						heading: s.boat?.heading ?? 0,
						speedMs: 0,
						accuracy: 4,
						source: "placed",
						at: Date.now()
					});
					s.setTapMode("none");
					s.setFollowBoat(false);
					return;
				}
				if (s.tapMode === "drop-anchor") return;
				if (s.tapMode === "draw-fence") {
					const first = s.fenceDraft[0];
					if (first && s.fenceDraft.length >= 3 && haversineMeters(first, wp) < 12) {
						s.commitFence();
						return;
					}
					s.appendFencePoint(wp);
					return;
				}
				if (s.tapMode === "draw-pack") {
					s.appendPackCorner(wp);
					return;
				}
				if (s.tapMode === "resize-swing") return;
			});
			map.on("dragstart", () => {
				if (useHelm.getState().followBoat && !useHelm.getState().demoPlaying) useHelm.getState().setFollowBoat(false);
			});
			let placingPtr = false;
			let resizePtr = false;
			const box = map.getContainer();
			const eventToLatLng = (ev) => {
				if (!map) return null;
				return map.mouseEventToLatLng(ev);
			};
			const applyResize = (ll) => {
				const a = useHelm.getState().anchor;
				if (!a) return;
				useHelm.getState().setAnchorRadius(haversineMeters(a, ll), true);
			};
			const onPointerDown = (ev) => {
				if (!map) return;
				const mode = useHelm.getState().tapMode;
				if (mode !== "drop-anchor" && mode !== "resize-swing") return;
				if (ev.pointerType === "mouse" && ev.button !== 0) return;
				try {
					box.setPointerCapture(ev.pointerId);
				} catch {}
				ev.preventDefault();
				const ll = eventToLatLng(ev);
				if (!ll) return;
				const finger = {
					lat: ll.lat,
					lng: ll.lng
				};
				if (mode === "resize-swing") {
					resizePtr = true;
					applyResize(finger);
					return;
				}
				placingPtr = true;
				const s = useHelm.getState();
				const bow = s.boat ? bowFromGps(s.boat, s.boat.heading, s.hull) : null;
				if (bow && haversineMeters(bow, finger) < 3) return;
				s.setHookPreview(bow ? snapToLayback(bow, finger, s.rode) : finger);
			};
			const onPointerMove = (ev) => {
				if (!map) return;
				const ll = eventToLatLng(ev);
				if (!ll) return;
				const finger = {
					lat: ll.lat,
					lng: ll.lng
				};
				if (resizePtr && useHelm.getState().tapMode === "resize-swing") {
					applyResize(finger);
					return;
				}
				if (!placingPtr) return;
				const s = useHelm.getState();
				if (s.tapMode !== "drop-anchor") return;
				const bow = s.boat ? bowFromGps(s.boat, s.boat.heading, s.hull) : null;
				if (bow && haversineMeters(bow, finger) < 3) return;
				s.setHookPreview(bow ? snapToLayback(bow, finger, s.rode) : finger);
			};
			const onPointerUp = () => {
				if (resizePtr) {
					resizePtr = false;
					if (useHelm.getState().tapMode === "resize-swing") useHelm.getState().setTapMode("none");
				}
				if (!placingPtr) return;
				placingPtr = false;
				const s = useHelm.getState();
				const p = s.hookPreview;
				if (!p || s.tapMode !== "drop-anchor") return;
				const bow = s.boat ? bowFromGps(s.boat, s.boat.heading, s.hull) : null;
				if (bow && haversineMeters(bow, p) < 2) return;
				s.dropAnchor(p.lat, p.lng);
				const note = rodeDropNote(s.rode);
				if (note) toast(note);
			};
			box.addEventListener("pointerdown", onPointerDown);
			box.addEventListener("pointermove", onPointerMove);
			window.addEventListener("pointermove", onPointerMove);
			window.addEventListener("pointerup", onPointerUp);
			window.addEventListener("pointercancel", onPointerUp);
			anchorMarker.on("dragstart", () => {
				hookDragging = true;
				if (map?.dragging.enabled()) map.dragging.disable();
			});
			anchorMarker.on("drag", () => {
				const ll = anchorMarker.getLatLng();
				const s = useHelm.getState();
				const bow = s.boat ? bowFromGps(s.boat, s.boat.heading, s.hull) : null;
				if (bow) rodeLine.setLatLngs([[bow.lat, bow.lng], [ll.lat, ll.lng]]);
				anchorCircle.setLatLng(ll);
			});
			anchorMarker.on("dragend", () => {
				hookDragging = false;
				const ll = anchorMarker.getLatLng();
				useHelm.getState().moveAnchor(ll.lat, ll.lng);
				const mode = useHelm.getState().tapMode;
				if (map && !map.dragging.enabled() && mode !== "drop-anchor" && mode !== "resize-swing") map.dragging.enable();
			});
			rimHandle.on("dragstart", () => {
				rimDragging = true;
				if (map?.dragging.enabled()) map.dragging.disable();
			});
			rimHandle.on("drag", () => {
				const a = useHelm.getState().anchor;
				if (!a) return;
				const ll = rimHandle.getLatLng();
				const r = haversineMeters(a, {
					lat: ll.lat,
					lng: ll.lng
				});
				anchorCircle.setRadius(r);
			});
			rimHandle.on("dragend", () => {
				rimDragging = false;
				const a = useHelm.getState().anchor;
				const ll = rimHandle.getLatLng();
				if (a) useHelm.getState().setAnchorRadius(haversineMeters(a, {
					lat: ll.lat,
					lng: ll.lng
				}), true);
				const mode = useHelm.getState().tapMode;
				if (map && !map.dragging.enabled() && mode !== "drop-anchor" && mode !== "resize-swing") map.dragging.enable();
			});
			const publishZoom = () => {
				if (!map) return;
				useHelm.getState().setChartZoom(map.getZoom());
				const b = map.getBounds();
				b.getSouth(), b.getWest(), b.getNorth(), b.getEast(), map.getZoom();
			};
			map.on("moveend", publishZoom);
			map.on("zoom", publishZoom);
			map.on("zoomend", publishZoom);
			publishZoom();
			const onZoom = (ev) => {
				if (ev.detail > 0) map?.zoomIn();
				else map?.zoomOut();
			};
			const onCloseIn = () => {
				const boat = useHelm.getState().boat;
				if (!boat || !map) return;
				useHelm.getState().setFollowBoat(true);
				followArmed = true;
				map.setView([boat.lat, boat.lng], CLOSE_ZOOM, { animate: true });
			};
			window.addEventListener("rp-zoom", onZoom);
			window.addEventListener("rp-close-in", onCloseIn);
			const prevUnsub = unsub;
			unsub = () => {
				prevUnsub();
				window.removeEventListener("rp-zoom", onZoom);
				window.removeEventListener("rp-close-in", onCloseIn);
				box.removeEventListener("pointerdown", onPointerDown);
				box.removeEventListener("pointermove", onPointerMove);
				window.removeEventListener("pointermove", onPointerMove);
				window.removeEventListener("pointerup", onPointerUp);
				window.removeEventListener("pointercancel", onPointerUp);
			};
		});
		return () => {
			cancelled = true;
			paintSeaSet = null;
			unsub();
			map?.remove();
		};
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: hostRef,
		className: "absolute inset-0 z-0 bg-background",
		"aria-label": "Satellite chart"
	});
}
function BottomDock() {
	const panel = useHelm((s) => s.panel);
	const drawMode = useHelm((s) => s.drawMode);
	const draft = useHelm((s) => s.draft);
	const crumb = useHelm((s) => s.crumb);
	const setPanel = useHelm((s) => s.setPanel);
	const setDrawMode = useHelm((s) => s.setDrawMode);
	const popDraft = useHelm((s) => s.popDraft);
	const reverseTrack = useHelm((s) => s.reverseTrack);
	const canReverse = draft.length >= 2 || crumb.length >= 2;
	const toggle = (id) => setPanel(panel === id ? null : id);
	if (drawMode !== "idle") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto mx-auto flex max-w-lg items-center gap-2 rounded-xl border border-border bg-card p-1.5 shadow-[var(--shadow-border)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "danger",
					className: "flex-1",
					onClick: () => setDrawMode("idle"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, { className: "size-4" }), "Stop"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "helm",
					disabled: !canReverse,
					onClick: () => reverseTrack(),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Undo2, { className: "size-4" }), "Reverse"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "helm",
					disabled: draft.length === 0,
					onClick: popDraft,
					children: "Undo"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: "default",
					disabled: draft.length < 1,
					onClick: () => setPanel("save"),
					children: ["Save ", draft.length ? `(${draft.length})` : ""]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "pointer-events-none mt-1.5 text-center text-[11px] text-foreground",
			children: drawMode === "draw" ? "Tap the water to drop waypoints along the safe colour." : "Logging your GPS trail. Reverse follows it back out."
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		className: "pointer-events-none absolute inset-x-0 bottom-0 z-20 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto mx-auto grid max-w-lg grid-cols-5 gap-0.5 rounded-xl border border-border bg-card p-1 shadow-[var(--shadow-border)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DockBtn, {
					active: panel === "atlas",
					label: "Atlas",
					onClick: () => toggle("atlas"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Map, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DockBtn, {
					active: panel === "passages",
					label: "Tracks",
					onClick: () => toggle("passages"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DockBtn, {
					active: panel === "anchor",
					label: "Anchor",
					emphasize: true,
					onClick: () => toggle("anchor"),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Anchor, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DockBtn, {
					active: false,
					label: "Record",
					onClick: () => {
						useHelm.getState().setDraft([]);
						setDrawMode("record");
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DockBtn, {
					active: false,
					label: "Draw",
					onClick: () => {
						useHelm.getState().setDraft([]);
						setDrawMode("draw");
					},
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pencil, {})
				})
			]
		})
	});
}
function DockBtn({ active, label, children, onClick, emphasize }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
		variant: active || emphasize ? "default" : "ghost",
		onClick,
		className: "h-12 flex-col gap-0.5 rounded-lg px-1 text-[9px] font-medium tracking-wide uppercase",
		children: [children, label]
	});
}
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	const { data, isPending } = authClient.useSession();
	const user = data?.user;
	return {
		user: user ? {
			id: user.id,
			displayName: user.name ?? null,
			primaryEmail: user.email ?? null,
			profileImageUrl: user.image ?? null,
			isDevFallback: false
		} : null,
		isPending
	};
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
var subscribeToNothing = () => () => {};
var noGateSessionOnServer = () => false;
/** Render children only when a user is present (real session, or the disabled-auth dev user). */
function SignedIn({ children }) {
	const { user } = useCurrentUserState();
	return user ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children }) : null;
}
/**
* Render children only once we KNOW the visitor is signed out (`isPending` has
* cleared and there is no user). Hidden while the session is still loading.
*/
function SignedOut({ children }) {
	const { user, isPending } = useCurrentUserState();
	if (isPending || user) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of) and the session is not
* gate-materialized — behind the gate the next request signs the viewer
* straight back in, so a sign-out control there is a broken loop.
*/
function UserButton() {
	const user = useCurrentUser();
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	const gateSession = (0, import_react.useSyncExternalStore)(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			!gateSession && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: signingOut,
				onClick: () => {
					setSigningOut(true);
					signOut().catch(() => setSigningOut(false));
				},
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline",
				children: signingOut ? "Signing out…" : "Sign out"
			})
		]
	});
}
var badgeVariants = cva("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide", {
	variants: { variant: {
		default: "border-transparent bg-primary/15 text-primary",
		muted: "border-border bg-muted text-muted-foreground",
		danger: "border-transparent bg-destructive/15 text-destructive",
		holding: "border-transparent bg-primary/15 text-primary",
		warn: "border-transparent bg-accent text-accent-foreground"
	} },
	defaultVariants: { variant: "default" }
});
function Badge({ className, variant, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn(badgeVariants({ variant }), className),
		...props
	});
}
/** Civil sunrise/sunset (sun 50′ below horizon). Times are UTC ms. */
var D2R = Math.PI / 180;
var ZENITH = 90.833;
function sind(d) {
	return Math.sin(d * D2R);
}
function cosd(d) {
	return Math.cos(d * D2R);
}
function wrap360(d) {
	return (d % 360 + 360) % 360;
}
function utcMidnight(at) {
	const d = new Date(at);
	return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
/** NOAA sunrise/sunset for the UTC calendar day containing `at`. */
function sunRiseSet(lat, lng, at) {
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	const d = new Date(utcMidnight(at));
	const y = d.getUTCFullYear();
	const m = d.getUTCMonth() + 1;
	const day = d.getUTCDate();
	const N = Math.floor(275 * m / 9) - Math.floor((m + 9) / 12) * (1 + Math.floor((y - 4 * Math.floor(y / 4) + 2) / 3)) + day - 30;
	const lngHour = lng / 15;
	const event = (rising) => {
		const t = N + ((rising ? 6 : 18) - lngHour) / 24;
		const M = wrap360(.9856 * t - 3.289);
		const L = wrap360(M + 1.916 * sind(M) + .02 * sind(2 * M) + 282.634);
		let ra = wrap360(Math.atan(.91764 * Math.tan(L * D2R)) / D2R);
		const lq = Math.floor(L / 90) * 90;
		const rq = Math.floor(ra / 90) * 90;
		ra = (ra + (lq - rq)) / 15;
		const sinDec = .39782 * sind(L);
		const cosDec = Math.cos(Math.asin(sinDec));
		const cosH = (cosd(ZENITH) - sinDec * sind(lat)) / (cosDec * cosd(lat));
		if (cosH > 1 || cosH < -1) return null;
		let H = Math.acos(Math.min(1, Math.max(-1, cosH))) / D2R;
		if (rising) H = 360 - H;
		H /= 15;
		let ut = H + ra - .06571 * t - 6.622 - lngHour;
		ut = (ut % 24 + 24) % 24;
		return Date.UTC(y, m - 1, day) + ut * 36e5;
	};
	const rise = event(true);
	const set = event(false);
	if (rise == null || set == null) return null;
	return {
		rise,
		set
	};
}
/** Night intervals overlapping [t0, tEnd], from this lat/lng. */
function nightSpans(lat, lng, t0, tEnd) {
	const out = [];
	const first = utcMidnight(t0) - 864e5;
	const last = utcMidnight(tEnd) + 864e5;
	for (let day = first; day <= last; day += 864e5) {
		const sun = sunRiseSet(lat, lng, day);
		if (!sun) continue;
		let start;
		let end;
		if (sun.set < sun.rise) {
			start = sun.set;
			end = sun.rise;
		} else {
			const next = sunRiseSet(lat, lng, day + 864e5);
			start = sun.set;
			end = next?.rise ?? sun.set + 864e5;
			if (end <= start) end += 864e5;
		}
		const a = Math.max(start, t0);
		const b = Math.min(end, tEnd);
		if (b > a + 6e4) out.push({
			start: a,
			end: b
		});
	}
	return out;
}
function isDaylight(lat, lng, at) {
	const sun = sunRiseSet(lat, lng, at);
	if (!sun) {
		const near = sunRiseSet(lat, lng, at - 864e5) ?? sunRiseSet(lat, lng, at + 864e5);
		if (!near) return true;
		return at >= near.rise && at < near.set;
	}
	if (sun.rise <= sun.set) return at >= sun.rise && at < sun.set;
	return at >= sun.rise || at < sun.set;
}
function WindArrow({ deg, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 24 24",
		className: className ?? "size-5",
		style: { transform: `rotate(${deg + 180}deg)` },
		"aria-hidden": "true",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			fill: "currentColor",
			d: "M12 3.2 16.4 12H13v8.8h-2V12H7.6L12 3.2Z"
		})
	});
}
function WxStrip() {
	const panel = useHelm((s) => s.panel);
	const setPanel = useHelm((s) => s.setPanel);
	const wx = useWx();
	if (panel) return null;
	const data = wx.data;
	if (!data && !wx.isLoading && !wx.isError) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-16 bottom-[5.6rem] z-20 hidden md:inset-x-auto md:left-1/2 md:block md:w-[min(42rem,calc(100%-9rem))] md:-translate-x-1/2",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pointer-events-auto flex w-full items-stretch gap-2 overflow-hidden rounded-xl border border-border bg-card/95 px-2 py-2 shadow-[var(--shadow-border)] rp-glass",
			children: wx.isLoading && !data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-2 py-1 text-sm text-muted-foreground",
				children: "Fetching wind…"
			}) : wx.isError && !data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "px-2 py-1 text-left text-sm text-muted-foreground",
				onClick: () => setPanel("weather"),
				children: "Wind unavailable — tap for details."
			}) : data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setPanel("weather"),
				className: "shrink-0 rounded-lg text-left",
				"aria-label": "Open 24 hour wind and weather",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NowChip, { hour: data.now })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex min-w-0 flex-1 cursor-pointer gap-0.5 overflow-x-auto",
				onClick: () => setPanel("weather"),
				children: data.hours.slice(0, 24).map((h, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HourCol, {
					hour: h,
					max: data.maxWind.at === h.at,
					now: i === 0,
					peak: data.maxWind.windKn
				}, h.at))
			})] }) : null
		})
	});
}
function NowChip({ hour }) {
	const b = beaufort(hour.windKn);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex shrink-0 items-center gap-2 rounded-lg bg-background px-2 py-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WindArrow, {
			deg: hour.dirDeg,
			className: "size-6 text-primary"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "font-display text-xl leading-none font-semibold tabular-nums",
			children: [formatKn(hour.windKn), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ml-1 text-xs font-medium text-muted-foreground",
				children: "kn"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "text-[10px] tracking-wide text-muted-foreground uppercase",
			children: [
				windCardinal(hour.dirDeg),
				" · ",
				b.label
			]
		})] })]
	});
}
function HourCol({ hour, max, now, peak }) {
	const h = Math.max(4, Math.round(hour.windKn / Math.max(8, peak) * 28));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex w-9 shrink-0 flex-col items-center gap-0.5 rounded-md px-0.5 py-0.5 ${max ? "bg-primary/15" : now ? "bg-muted/60" : ""}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-[9px] tracking-wide text-muted-foreground uppercase",
				children: now ? "Now" : hourLabel(hour.at)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: `mt-auto w-1.5 rounded-full ${hour.windKn >= 22 ? "bg-destructive" : "bg-primary"}`,
				style: { height: h }
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "font-display text-xs leading-none font-semibold tabular-nums",
				children: Math.round(hour.windKn)
			})
		]
	});
}
function WeatherPanel() {
	const panel = useHelm((s) => s.panel);
	const setPanel = useHelm((s) => s.setPanel);
	const horizonH = useHelm((s) => s.wxHorizonH);
	const setHorizon = useHelm((s) => s.setWxHorizonH);
	const wx = useWx();
	if (panel !== "weather") return null;
	const data = wx.data;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-auto absolute inset-0 z-50 flex flex-col overflow-x-hidden overflow-y-auto bg-card pt-[max(0.4rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sticky top-0 z-10 border-b border-border/60 bg-card/95 px-3 py-1.5 backdrop-blur-md",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-lg font-semibold tracking-tight",
					children: "Forecast"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					size: "sm",
					className: "h-8 px-2",
					onClick: () => setPanel(null),
					children: "Close"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 flex flex-wrap gap-1",
				children: WX_HORIZONS.map((h) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: horizonH === h ? "default" : "outline",
					size: "sm",
					className: "h-7 px-2 text-xs",
					onClick: () => setHorizon(h),
					children: horizonLabel(h)
				}, h))
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-full px-3 pt-2",
			children: [
				wx.isLoading && !data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "Fetching forecast…"
				}) : null,
				wx.isError && !data ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "Forecast did not load."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						onClick: () => void wx.refetch(),
						children: "Retry"
					})]
				}) : null,
				data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WxBody, {
					data,
					horizonH
				}) : null
			]
		})]
	});
}
function WxBody({ data, horizonH }) {
	const hours = sliceByHorizon(data.hours, horizonH);
	const altHours = data.alt ? sliceByHorizon(data.alt.hours, horizonH) : void 0;
	const stats = windowStats(hours.length ? hours : data.hours.slice(0, 1));
	const maxB = beaufort(stats.maxWind.windKn);
	const strong = stats.maxWind.windKn >= 22;
	const [showAlt, setShowAlt] = (0, import_react.useState)(Boolean(data.alt));
	const setHours = data.sea ? data.sea.currentHours.filter((h) => {
		const t0 = data.hours[0]?.at ?? data.now.at;
		return h.at <= t0 + horizonH * 36e5 + 12e5;
	}) : [];
	const waveHours = data.sea ? data.sea.waveHours.filter((h) => {
		const t0 = data.hours[0]?.at ?? data.now.at;
		return h.at <= t0 + horizonH * 36e5 + 12e5;
	}) : [];
	const hasTide = Boolean(data.sea && data.sea.tideHours.length >= 2);
	const hasCurrent = setHours.length >= 4;
	const hasWaves = waveHours.length >= 4;
	const [layers, setLayers] = (0, import_react.useState)({
		wind: true,
		tide: hasTide,
		current: hasCurrent,
		waves: hasWaves
	});
	const toggle = (key) => {
		setLayers((s) => {
			const next = {
				...s,
				[key]: !s[key]
			};
			if (!next.wind && !next.tide && !next.current && !next.waves) return s;
			return next;
		});
	};
	const chips = [
		{
			key: "wind",
			label: "Wind",
			on: layers.wind,
			show: true
		},
		{
			key: "tide",
			label: tideOriginChip(data.sea?.tideOrigin ?? null),
			on: layers.tide,
			show: hasTide
		},
		{
			key: "current",
			label: "Current",
			on: layers.current,
			show: hasCurrent
		},
		{
			key: "waves",
			label: "Waves",
			on: layers.waves,
			show: hasWaves
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid w-full max-w-full gap-3",
		children: [
			strong ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "rounded-md bg-destructive/10 px-2.5 py-1.5 text-sm text-destructive",
				children: [
					maxB.label,
					" later — ",
					formatKn(stats.maxWind.windKn),
					" kn ",
					windCardinal(stats.maxWind.dirDeg),
					" ",
					"at ",
					hourLabel(stats.maxWind.at)
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-1",
				children: [chips.filter((c) => c.show).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: c.on ? "default" : "outline",
					size: "sm",
					className: "h-8 px-2.5 text-xs",
					onClick: () => toggle(c.key),
					children: c.label
				}, c.key)), data.alt && layers.wind ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "ml-auto px-1 text-[10px] text-muted-foreground uppercase underline-offset-2 hover:underline",
					onClick: () => setShowAlt((v) => !v),
					children: showAlt ? "ECMWF" : "+ GFS"
				}) : null]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SeaStack, {
				hours,
				alt: showAlt ? altHours : void 0,
				horizonH,
				tideHours: data.sea?.tideHours,
				tideTurns: data.sea?.tideTurns,
				latDatum: data.sea?.latDatumM ?? null,
				tideOrigin: data.sea?.tideOrigin ?? null,
				currentHours: setHours,
				waveHours,
				layers,
				lat: data.lat,
				lng: data.lng
			})
		]
	});
}
var GRAPH_W = 320;
var GRAPH_H = 228;
var PAD_L = 34;
var PAD_R = 36;
var PAD_T = 14;
var PAD_B = 22;
var DAY_FILL = "#16324a";
var NIGHT_FILL = "#000000";
var TWILIGHT_MS = 3e6;
function SeaStack({ hours, alt, horizonH, tideHours, tideTurns, latDatum, tideOrigin, currentHours, waveHours, layers, lat, lng }) {
	const t0 = hours[0]?.at ?? Date.now();
	const tEnd = t0 + horizonH * 36e5;
	const now = Date.now();
	const [cursorAt, setCursorAt] = (0, import_react.useState)(() => Math.min(tEnd, Math.max(t0, now)));
	const cursor = Math.min(tEnd, Math.max(t0, cursorAt));
	const wx = nearestSample(hours, cursor);
	const tides = tideHours ? windowTide(tideHours, t0, horizonH) : [];
	const datum = tideOrigin?.kind === "station" ? 0 : latDatum ?? (tides.length ? latDatumM(tides) : 0);
	const tideMsl = tides.length ? tideAt(tides, cursor) : null;
	const tideM = tideMsl != null ? toLatM(tideMsl, datum) : null;
	const rising = tides.length ? tideRising(tides, cursor) : null;
	const cur = nearestSample(currentHours, cursor);
	const wave = nearestSample(waveHours, cursor);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid w-full max-w-full gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ForecastGraph, {
				hours,
				alt,
				horizonH,
				tideHours,
				tideTurns,
				latDatum: datum,
				layers,
				currentHours,
				waveHours,
				cursorAt: cursor,
				onCursor: setCursorAt,
				height: GRAPH_H,
				lat,
				lng
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2 rounded-xl border border-border bg-background px-3 py-2.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadoutCell, {
						label: Math.abs(cursor - now) < 12e5 ? "Now" : "At",
						value: clockLabel(cursor),
						hint: isDaylight(lat, lng, cursor) ? "Day" : "Night"
					}),
					layers.wind && wx ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadoutCell, {
						label: "Wind",
						value: `${formatKn(wx.windKn)} kn`,
						hint: `${windCardinal(wx.dirDeg)}${wx.gustKn != null ? ` · gust ${formatKn(wx.gustKn)}` : ""}`,
						arrowDeg: wx.dirDeg + 180
					}) : null,
					layers.tide && tideM != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadoutCell, {
						label: tideOrigin?.kind === "station" ? "Tide LAT" : "Tide (model)",
						value: `${tideM.toFixed(2)} m`,
						hint: (rising == null ? "Slack" : rising ? "Rising" : "Falling") + (tideOrigin?.kind === "station" ? " · BOM station" : " · LAT estimate")
					}) : null,
					layers.waves && wave ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadoutCell, {
						label: "Waves",
						value: `${wave.heightM.toFixed(1)} m`,
						hint: `${wave.periodS ? `${wave.periodS} s · ` : ""}to ${windCardinal((wave.dirDeg + 180) % 360)}`,
						arrowDeg: wave.dirDeg + 180,
						arrowClass: "text-cyan-300"
					}) : null,
					layers.current && cur ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadoutCell, {
						label: "Current",
						value: `${formatKn(cur.kn)} kn`,
						hint: `to ${windCardinal(cur.dirDeg)}`,
						arrowDeg: cur.dirDeg,
						arrowClass: "text-amber-300"
					}) : null
				]
			}),
			layers.tide ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[11px] leading-snug text-muted-foreground",
				children: [tideOriginLabel(tideOrigin), tideOrigin?.kind === "station" ? ". Curve is drawn between the published high and low — not a measured depth." : ". Use a port table when you are in one."]
			}) : null
		]
	});
}
function NightShade({ lat, lng, t0, horizonH, height, padT, padB }) {
	const tEnd = t0 + horizonH * 36e5;
	const innerH = Math.max(0, height - padT - padB);
	const plotW = 250;
	const nights = nightSpans(lat, lng, t0, tEnd);
	const gid = `dusk-${Math.round(t0)}-${height}-${padT}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
		className: "pointer-events-none",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: nights.map((n, i) => {
				const fadeIn = n.start > t0 + 3e4;
				const fadeOut = n.end < tEnd - 3e4;
				const visStart = fadeIn ? n.start - TWILIGHT_MS : n.start;
				const visEnd = fadeOut ? n.end + TWILIGHT_MS : n.end;
				const x0 = graphXAt(visStart, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
				const x1 = graphXAt(visEnd, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
				const span = Math.max(1, visEnd - visStart);
				const inOff = fadeIn ? TWILIGHT_MS / span * 100 : 0;
				const outOff = fadeOut ? 100 - TWILIGHT_MS / span * 100 : 100;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
					id: `${gid}-${i}`,
					gradientUnits: "userSpaceOnUse",
					x1: x0,
					y1: padT,
					x2: x1,
					y2: padT,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
							offset: "0%",
							stopColor: NIGHT_FILL,
							stopOpacity: fadeIn ? 0 : 1
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
							offset: `${inOff}%`,
							stopColor: NIGHT_FILL,
							stopOpacity: "1"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
							offset: `${outOff}%`,
							stopColor: NIGHT_FILL,
							stopOpacity: "1"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
							offset: "100%",
							stopColor: NIGHT_FILL,
							stopOpacity: fadeOut ? 0 : 1
						})
					]
				}, n.start);
			}) }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				x: PAD_L,
				y: padT,
				width: plotW,
				height: innerH,
				style: { fill: DAY_FILL }
			}),
			nights.map((n, i) => {
				const fadeIn = n.start > t0 + 3e4;
				const fadeOut = n.end < tEnd - 3e4;
				const visStart = fadeIn ? n.start - TWILIGHT_MS : n.start;
				const visEnd = fadeOut ? n.end + TWILIGHT_MS : n.end;
				const x0 = graphXAt(visStart, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
				const x1 = graphXAt(visEnd, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: x0,
					y: padT,
					width: Math.max(0, x1 - x0),
					height: innerH,
					fill: `url(#${gid}-${i})`
				}, n.start);
			})
		]
	});
}
function ReadoutCell({ label, value, hint, arrowDeg, arrowClass }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start gap-2",
		children: [arrowDeg != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
			viewBox: "0 0 24 24",
			className: `mt-0.5 size-6 shrink-0 ${arrowClass ?? "text-primary"}`,
			style: { transform: `rotate(${arrowDeg}deg)` },
			"aria-hidden": true,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				fill: "currentColor",
				stroke: "#0b1c24",
				strokeWidth: "1.2",
				strokeLinejoin: "round",
				d: "M12 2.2 18.4 20.2 12 15.4 5.6 20.2Z"
			})
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
					children: label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-xl leading-none font-semibold tabular-nums",
					children: value
				}),
				hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-[11px] text-muted-foreground",
					children: hint
				}) : null
			]
		})]
	});
}
function pointerToAt(ev, svg, t0, horizonH) {
	const ctm = svg.getScreenCTM();
	if (!ctm) return t0;
	const pt = svg.createSVGPoint();
	pt.x = ev.clientX;
	pt.y = ev.clientY;
	const p = pt.matrixTransform(ctm.inverse());
	return t0 + Math.max(0, Math.min(1, (p.x - PAD_L) / 250)) * horizonH * 36e5;
}
function PlotArrow({ x, y, deg, fill, size = 1 }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", {
		transform: `translate(${x} ${y}) rotate(${deg}) scale(${size})`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M0 -9 L6.5 8.5 L0 4.2 L-6.5 8.5 Z",
			className: fill,
			stroke: "#0b1c24",
			strokeWidth: "1.3",
			strokeLinejoin: "round"
		})
	});
}
function metreTicks(minM, maxM) {
	const step = maxM - minM > 2.2 ? .5 : .2;
	const start = Math.floor(minM / step) * step;
	const out = [];
	for (let v = start; v <= maxM + .001; v += step) if (v >= minM - .05) out.push(Math.round(v * 10) / 10);
	return out.length ? out : [minM, maxM];
}
function ForecastGraph({ hours, alt, horizonH, tideHours, tideTurns, latDatum, layers, currentHours, waveHours, cursorAt, onCursor, height, fill, lat, lng }) {
	const svgRef = (0, import_react.useRef)(null);
	const H = height ?? GRAPH_H;
	const t0 = hours[0]?.at ?? Date.now();
	const tEnd = t0 + horizonH * 36e5;
	const now = Date.now();
	const [localAt, setLocalAt] = (0, import_react.useState)(() => Math.min(tEnd, Math.max(t0, now)));
	const dragging = (0, import_react.useRef)(false);
	const setAt = (n) => {
		onCursor?.(n);
		if (cursorAt == null) setLocalAt(n);
	};
	const showWind = layers.wind && hours.length >= 2;
	const showTide = layers.tide && Boolean(tideHours && tideHours.length >= 2);
	const showCurrent = Boolean(layers.current && currentHours && currentHours.length >= 2);
	const showWaves = Boolean(layers.waves && waveHours && waveHours.length >= 2);
	if (!showWind && !showTide && !showCurrent && !showWaves) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted-foreground",
		children: "Turn a layer on."
	});
	const tidesMsl = tideHours ? windowTide(tideHours, t0, horizonH) : [];
	const datum = latDatum ?? (tidesMsl.length ? latDatumM(tidesMsl) : 0);
	const tides = tidesMsl.map((h) => ({
		at: h.at,
		m: toLatM(h.m, datum)
	}));
	const tideRng = tides.length >= 2 ? tideRange(tides) : null;
	const waveMax = waveHours?.length ? Math.max(...waveHours.map((h) => h.heightM), .5) : 0;
	let minM = 0;
	let maxM = 1;
	if (showTide && tideRng) {
		minM = tideRng.minM;
		maxM = tideRng.maxM;
	}
	if (showWaves) {
		minM = Math.min(minM, 0);
		maxM = Math.max(maxM, waveMax);
	}
	const metreSpan = Math.max(.2, maxM - minM);
	const range = showTide || showWaves ? {
		minM,
		maxM
	} : null;
	const windMax = graphMaxKn([...hours, ...alt ?? []]);
	const curMax = currentHours?.length ? Math.max(1, Math.ceil(Math.max(...currentHours.map((h) => h.kn), .5) * 2) / 2) : 1;
	const knMax = showWind ? windMax : curMax;
	const rainMax = Math.max(2, ...hours.map((h) => h.precipMm));
	const innerH = H - PAD_T - PAD_B;
	const yKn = (kn) => PAD_T + innerH - kn / Math.max(1, knMax) * innerH;
	const yWind = yKn;
	const yTide = (m) => PAD_T + innerH - (m - minM) / metreSpan * innerH;
	const yWave = yTide;
	const yCurrent = (kn) => PAD_T + innerH - kn / Math.max(.4, curMax) * innerH;
	const windD = showWind ? graphLineTimed(hours.map((h) => ({
		at: h.at,
		v: h.windKn
	})), t0, horizonH, GRAPH_W, H, knMax, PAD_L, PAD_R, PAD_T, PAD_B) : "";
	const gustD = showWind ? graphLineTimed(hours.map((h) => ({
		at: h.at,
		v: h.gustKn ?? h.windKn
	})), t0, horizonH, GRAPH_W, H, knMax, PAD_L, PAD_R, PAD_T, PAD_B) : "";
	const altD = showWind && alt && alt.length >= 2 ? graphLineTimed(alt.map((h) => ({
		at: h.at,
		v: h.windKn
	})), t0, horizonH, GRAPH_W, H, knMax, PAD_L, PAD_R, PAD_T, PAD_B) : "";
	const tideD = showTide && range && tides.length >= 2 ? graphAreaTimed(tides.map((h) => ({
		at: h.at,
		v: h.m
	})), t0, horizonH, GRAPH_W, H, range.minM, range.maxM, PAD_L, PAD_R, PAD_T, PAD_B) : "";
	const tideLine = showTide && range && tides.length >= 2 ? graphLineTimed(tides.map((h) => ({
		at: h.at,
		v: h.m - range.minM
	})), t0, horizonH, GRAPH_W, H, Math.max(.2, range.maxM - range.minM), PAD_L, PAD_R, PAD_T, PAD_B) : "";
	const waveLine = showWaves && range && waveHours && waveHours.length >= 2 ? graphLineTimed(waveHours.map((h) => ({
		at: h.at,
		v: h.heightM - range.minM
	})), t0, horizonH, GRAPH_W, H, metreSpan, PAD_L, PAD_R, PAD_T, PAD_B) : "";
	const currentLine = showCurrent && currentHours && currentHours.length >= 2 ? graphLineTimed(currentHours.map((h) => ({
		at: h.at,
		v: h.kn
	})), t0, horizonH, GRAPH_W, H, curMax, PAD_L, PAD_R, PAD_T, PAD_B) : "";
	const turns = (tideTurns ?? []).filter((t) => t.at >= t0 - 12e5 && t.at <= tEnd + 12e5).map((t) => ({
		...t,
		m: toLatM(t.m, datum)
	}));
	const ticks = horizonTicks(t0, horizonH);
	const cursor = Math.min(tEnd, Math.max(t0, cursorAt ?? localAt));
	const wx = nearestSample(hours, cursor);
	const tideM = tides.length ? tideAt(tides, cursor) : null;
	const rising = tides.length ? tideRising(tides, cursor) : null;
	const cursorX = graphXAt(cursor, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
	const nowX = graphXAt(now, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
	const nowOn = now >= t0 && now <= tEnd;
	const arrowEvery = horizonH <= 24 ? 3 : horizonH <= 48 ? 4 : 12;
	const owned = cursorAt == null;
	const onDown = (ev) => {
		const svg = svgRef.current;
		if (!svg) return;
		dragging.current = true;
		try {
			svg.setPointerCapture(ev.pointerId);
		} catch {}
		setAt(pointerToAt(ev, svg, t0, horizonH));
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: fill ? "h-full w-full max-w-full" : "w-full max-w-full",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			ref: svgRef,
			viewBox: `0 0 ${GRAPH_W} ${H}`,
			className: fill ? "size-full touch-none" : "h-auto w-full touch-none",
			preserveAspectRatio: fill ? "none" : "xMidYMid meet",
			role: "img",
			"aria-label": "Wind and tide graph. Drag to read a time.",
			onPointerDown: onDown,
			onPointerMove: (ev) => {
				if (!dragging.current || !svgRef.current) return;
				setAt(pointerToAt(ev, svgRef.current, t0, horizonH));
			},
			onPointerUp: () => {
				dragging.current = false;
			},
			onPointerCancel: () => {
				dragging.current = false;
			},
			children: [
				lat != null && lng != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NightShade, {
					lat,
					lng,
					t0,
					horizonH,
					height: H,
					padT: PAD_T,
					padB: PAD_B
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: PAD_L,
					y: PAD_T,
					width: 250,
					height: H - PAD_T - PAD_B,
					style: { fill: "#16324a" }
				}),
				tideD ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: tideD,
					fill: "#38bdf8",
					fillOpacity: "0.16"
				}) : null,
				showWind || showCurrent && !showWind ? [knMax, knMax / 2].map((g) => {
					const y = showWind ? yWind(g) : yCurrent(g);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: PAD_L,
						x2: 284,
						y1: y,
						y2: y,
						stroke: "currentColor",
						className: "text-border",
						strokeWidth: "1"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: "2",
						y: y + 3,
						className: "fill-muted-foreground",
						fontSize: "9",
						children: g
					})] }, `w${g}`);
				}) : null,
				range ? metreTicks(range.minM, range.maxM).map((m) => {
					const y = yTide(m);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: 318,
						y: y + 3,
						textAnchor: "end",
						className: "fill-sky-300",
						fontSize: "8",
						children: m.toFixed(1)
					}, `t${m}`);
				}) : null,
				range ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
					x: 318,
					y: 10,
					textAnchor: "end",
					className: "fill-sky-300",
					fontSize: "8",
					children: showTide ? "m LAT" : "m"
				}) : null,
				showWind || showCurrent && !showWind ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
					x: "2",
					y: "10",
					className: "fill-muted-foreground",
					fontSize: "8",
					children: "kn"
				}) : null,
				showWind ? hours.map((h) => {
					if (h.precipMm < .1) return null;
					const x = graphXAt(h.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
					const rh = Math.min(18, h.precipMm / rainMax * 18);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: x - 1.2,
						y: PAD_T + innerH - rh,
						width: horizonH > 72 ? 1.2 : 2.6,
						height: rh,
						className: "fill-sky-400/50"
					}, `r${h.at}`);
				}) : null,
				gustD ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: gustD,
					fill: "none",
					stroke: "currentColor",
					className: "text-muted-foreground",
					strokeWidth: "1.4",
					strokeDasharray: "3 3"
				}) : null,
				altD ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: altD,
					fill: "none",
					stroke: "currentColor",
					className: "text-foreground",
					strokeWidth: "1.5",
					opacity: "0.5"
				}) : null,
				windD ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: windD,
					fill: "none",
					stroke: "currentColor",
					className: "text-primary",
					strokeWidth: "2.4",
					strokeLinejoin: "round",
					strokeLinecap: "round"
				}) : null,
				tideLine ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: tideLine,
					fill: "none",
					stroke: "currentColor",
					className: "text-sky-300",
					strokeWidth: "2.2",
					strokeLinejoin: "round"
				}) : null,
				waveLine ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: waveLine,
					fill: "none",
					stroke: "currentColor",
					className: "text-cyan-300",
					strokeWidth: "2.1",
					strokeLinejoin: "round",
					strokeDasharray: "5 3"
				}) : null,
				currentLine ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: currentLine,
					fill: "none",
					stroke: "currentColor",
					className: "text-amber-300",
					strokeWidth: "2",
					strokeLinejoin: "round"
				}) : null,
				showWind && horizonH <= 72 ? hours.map((h, i) => {
					if (i % arrowEvery !== 0) return null;
					const x = graphXAt(h.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
					const y = yWind(h.windKn);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlotArrow, {
						x,
						y,
						deg: h.dirDeg + 180,
						fill: "fill-primary"
					}, `d${h.at}`);
				}) : null,
				showWaves && waveHours && horizonH <= 72 ? waveHours.map((h, i) => {
					if (i % arrowEvery !== 0) return null;
					const x = graphXAt(h.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
					const y = yWave(h.heightM);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlotArrow, {
						x,
						y,
						deg: h.dirDeg + 180,
						fill: "fill-cyan-300"
					}, `w${h.at}`);
				}) : null,
				showCurrent && currentHours && horizonH <= 72 ? currentHours.map((h, i) => {
					if (i % arrowEvery !== 0) return null;
					const x = graphXAt(h.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
					const y = yCurrent(h.kn);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlotArrow, {
						x,
						y,
						deg: h.dirDeg,
						fill: "fill-amber-300"
					}, `c${h.at}`);
				}) : null,
				showTide && range && horizonH <= 96 ? turns.map((t) => {
					const x = graphXAt(t.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R);
					const y = yTide(t.m);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						cx: x,
						cy: y,
						r: "2.4",
						className: t.kind === "high" ? "fill-sky-200" : "fill-sky-500"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x,
						y: Math.max(16, y - 7),
						textAnchor: "middle",
						className: "fill-sky-200",
						fontSize: "8",
						children: t.kind === "high" ? `HW ${t.m.toFixed(1)}` : `LW ${t.m.toFixed(1)}`
					})] }, `${t.kind}${t.at}`);
				}) : null,
				nowOn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: nowX,
					x2: nowX,
					y1: PAD_T,
					y2: H - PAD_B,
					stroke: "currentColor",
					className: "text-foreground",
					strokeWidth: "1.2",
					strokeDasharray: "3 3"
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1: cursorX,
					x2: cursorX,
					y1: PAD_T,
					y2: H - PAD_B,
					stroke: "currentColor",
					className: "text-primary",
					strokeWidth: "1.7"
				}),
				ticks.map((tick) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
					x: graphXAt(tick.at, t0, horizonH, GRAPH_W, PAD_L, PAD_R),
					y: H - 5,
					textAnchor: "middle",
					className: "fill-muted-foreground",
					fontSize: "9",
					children: tick.label
				}, tick.at))
			]
		}), owned ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-2 grid grid-cols-2 gap-2 rounded-lg border border-border bg-background px-3 py-2.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadoutCell, {
					label: Math.abs(cursor - now) < 12e5 ? "Now" : "At",
					value: clockLabel(cursor)
				}),
				showWind && wx ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadoutCell, {
					label: "Wind",
					value: `${formatKn(wx.windKn)} kn`,
					hint: `${windCardinal(wx.dirDeg)}${wx.gustKn != null ? ` · gust ${formatKn(wx.gustKn)}` : ""}`,
					arrowDeg: wx.dirDeg + 180
				}) : null,
				showTide ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReadoutCell, {
					label: "Tide LAT",
					value: tideM != null ? `${tideM.toFixed(2)} m` : "—",
					hint: rising == null ? "Slack" : rising ? "Rising" : "Falling"
				}) : null
			]
		}) : null]
	});
}
function AnchorWxCard() {
	const wx = useWx();
	const setPanel = useHelm((s) => s.setPanel);
	const setHorizon = useHelm((s) => s.setWxHorizonH);
	const data = wx.data;
	if (!data) return wx.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mb-2 text-xs text-muted-foreground",
		children: "Loading 24 h wind & tide…"
	}) : null;
	const hours = sliceByHorizon(data.hours, 24);
	const stats = windowStats(hours);
	const sea = data.sea;
	const riseNow = sea ? tideRiseAt(sea.tideTurns, sea.tideHours, Date.now()) : null;
	const hw = riseNow?.high ?? null;
	const lw = riseNow?.low ?? null;
	const datum = sea?.tideOrigin?.kind === "station" ? 0 : sea?.latDatumM ?? (sea?.tideHours.length ? latDatumM(sea.tideHours) : 0);
	const rise = riseNow?.riseM ?? 0;
	const draftM = useHelm((s) => s.hull.draftM);
	const tideNow = riseNow != null ? toLatM(riseNow.nowM, datum) : null;
	const need = tideNow != null ? chartedDepthNeededM(draftM, tideNow) : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-2 rounded-lg border border-border bg-background px-3 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			className: "w-full text-left",
			onClick: () => {
				setHorizon(24);
				setPanel("weather");
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
					children: "Next 24 h at the hook"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-0.5 text-sm text-foreground",
					children: [
						"Wind ",
						formatKn(data.now.windKn),
						" kn ",
						windCardinal(data.now.dirDeg),
						stats.maxWind.windKn > data.now.windKn + 2 ? ` · max ${formatKn(stats.maxWind.windKn)} kn ${hourLabel(stats.maxWind.at)}` : ""
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-0.5 text-[12px] text-muted-foreground",
					children: [hw ? `HW ${toLatM(hw.m, datum).toFixed(1)} m LAT ${hourLabel(hw.at)}${rise > 0 ? ` · +${rise.toFixed(1)} m` : ""}` : "Tide —", lw ? ` · LW ${toLatM(lw.m, datum).toFixed(1)} m` : ""]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-[11px] text-muted-foreground",
					children: tideOriginLabel(sea?.tideOrigin)
				}),
				need != null && tideNow != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-[12px] text-foreground",
					children: [
						"Draw ",
						draftM.toFixed(1),
						" m. Tide ",
						tideNow >= 0 ? "+" : "",
						tideNow.toFixed(1),
						" m LAT. Stay in water charted deeper than ",
						need.toFixed(1),
						" m. Not a sounder."
					]
				}) : null
			]
		}), hours.length >= 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-2",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ForecastGraph, {
				hours,
				horizonH: 24,
				tideHours: sea?.tideHours,
				tideTurns: sea?.tideTurns,
				latDatum: sea?.latDatumM ?? void 0,
				layers: {
					wind: true,
					tide: Boolean(sea && sea.tideHours.length >= 2),
					current: false,
					waves: false
				},
				height: 188,
				lat: data.lat,
				lng: data.lng
			})
		}) : null]
	});
}
function WindInstrument({ compact }) {
	const wx = useWx();
	const setPanel = useHelm((s) => s.setPanel);
	const panel = useHelm((s) => s.panel);
	const hour = wx.data?.now;
	const strong = (hour?.windKn ?? 0) >= 22;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: () => setPanel(panel === "weather" ? null : "weather"),
		className: compact ? "min-w-0 flex-1 px-2 py-1.5 text-left" : "min-w-[5.5rem] px-3 py-2 text-left",
		"aria-label": "24 hour wind and weather",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
			children: "Wind"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: `font-display leading-none font-semibold tabular-nums rp-instrument-value ${compact ? "text-lg" : "text-[1.35rem]"} ${strong ? "text-destructive" : ""}`,
			children: [hour ? formatKn(hour.windKn) : wx.isLoading ? "…" : "—", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ml-0.5 text-[10px] font-medium text-muted-foreground",
				children: hour ? `kn ${windCardinal(hour.dirDeg)}` : "kn"
			})]
		})]
	});
}
var lastKey = "";
async function registerWatchWorker() {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
	try {
		await navigator.serviceWorker.register("/reefpilot-watch.js", { scope: "/" });
	} catch {}
}
async function armWatchAlerts() {
	await registerWatchWorker();
	if (typeof Notification === "undefined") return;
	if (Notification.permission === "default") try {
		await Notification.requestPermission();
	} catch {}
}
function post(msg) {
	const ctl = navigator.serviceWorker?.controller;
	if (ctl) {
		ctl.postMessage(msg);
		return;
	}
	if (msg.type === "show" && typeof Notification !== "undefined" && Notification.permission === "granted") try {
		const n = new Notification(msg.title, {
			body: msg.body,
			tag: "reefpilot-watch",
			requireInteraction: true,
			silent: false
		});
		n.onclick = () => {
			window.focus();
			n.close();
		};
	} catch {}
}
function showWatchNotice(kind, body) {
	const title = kind === "drag" ? "Anchor dragging" : kind === "xte" ? "Off track" : kind === "mob" ? "Man overboard" : "GPS lost";
	const key = `${kind}:${body}`;
	if (key === lastKey) return;
	lastKey = key;
	post({
		type: "show",
		title,
		body
	});
	try {
		navigator.vibrate?.([
			240,
			80,
			240,
			80,
			480
		]);
	} catch {}
}
function clearWatchNotice() {
	if (!lastKey) return;
	lastKey = "";
	post({ type: "clear" });
}
function freshGuard(now, visible) {
	return {
		lastGoodAt: null,
		visible,
		becameVisibleAt: visible ? now : null,
		dragSince: null,
		xteSince: null
	};
}
function isGoodFix(accuracyM, source) {
	if (source === "demo") return true;
	if (source === "placed") return false;
	if (accuracyM == null || !Number.isFinite(accuracyM)) return true;
	return accuracyM <= 80;
}
function held(since, now) {
	return since != null && now - since >= 12e3;
}
function stepGuard(s, e) {
	let lastGoodAt = s.lastGoodAt;
	let becameVisibleAt = s.becameVisibleAt;
	let dragSince = s.dragSince;
	let xteSince = s.xteSince;
	if (e.visible && !s.visible) becameVisibleAt = e.now;
	if (!e.visible) becameVisibleAt = s.becameVisibleAt;
	if (e.goodFix) lastGoodAt = e.fixAt ?? e.now;
	else if (e.armed && e.visible && lastGoodAt == null) lastGoodAt = e.now;
	if (!e.visible) return {
		state: {
			lastGoodAt,
			visible: false,
			becameVisibleAt,
			dragSince,
			xteSince
		},
		alarms: {
			drag: held(dragSince, e.now),
			xte: held(xteSince, e.now),
			gpsLost: false
		}
	};
	if (!e.armed) return {
		state: {
			lastGoodAt: null,
			visible: true,
			becameVisibleAt,
			dragSince: null,
			xteSince: null
		},
		alarms: {
			drag: false,
			xte: false,
			gpsLost: false
		}
	};
	if (e.goodFix) {
		dragSince = e.dragging ? dragSince ?? e.now : null;
		xteSince = e.offTrack ? xteSince ?? e.now : null;
	}
	const gpsLost = !(becameVisibleAt != null && e.now - becameVisibleAt < 2e4) && lastGoodAt != null && e.now - lastGoodAt >= 6e4;
	return {
		state: {
			lastGoodAt,
			visible: true,
			becameVisibleAt,
			dragSince,
			xteSince
		},
		alarms: {
			drag: held(dragSince, e.now),
			xte: held(xteSince, e.now),
			gpsLost
		}
	};
}
var MUSGRAVE = [
	{
		lat: -23.8918,
		lng: 152.3842,
		label: "Deep approach"
	},
	{
		lat: -23.8964,
		lng: 152.3878,
		label: "Outer cut"
	},
	{
		lat: -23.8998,
		lng: 152.3906,
		label: "Channel"
	},
	{
		lat: -23.9026,
		lng: 152.3934,
		label: "Inner turn"
	},
	{
		lat: -23.9058,
		lng: 152.3964,
		label: "Lagoon sand"
	}
];
function useGpsWatch() {
	(0, import_react.useEffect)(() => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			useHelm.getState().setGpsDenied(true);
			return;
		}
		const applyFix = (pos) => {
			const s = useHelm.getState();
			if (s.demoPlaying) return;
			const heading = Number.isFinite(pos.coords.heading) ? pos.coords.heading : s.boat?.heading ?? null;
			const fix = {
				lat: pos.coords.latitude,
				lng: pos.coords.longitude,
				heading,
				speedMs: pos.coords.speed ?? 0,
				accuracy: pos.coords.accuracy,
				source: "gps",
				at: Date.now()
			};
			const firstLive = s.boat?.source !== "gps";
			s.setBoat(fix);
			s.setGpsDenied(false);
			if (firstLive) {
				s.setFollowBoat(true);
				s.fly(fix.lat, fix.lng, HELM_ZOOM);
			}
			if (s.drawMode === "record") {
				const last = s.draft[s.draft.length - 1];
				if (!last || haversineMeters(last, fix) >= 10) s.appendDraft({
					lat: fix.lat,
					lng: fix.lng
				});
			}
		};
		const onErr = (err) => {
			if (err.code === err.PERMISSION_DENIED) useHelm.getState().setGpsDenied(true);
		};
		const opts = {
			enableHighAccuracy: true,
			maximumAge: 8e3,
			timeout: 25e3
		};
		navigator.geolocation.getCurrentPosition(applyFix, onErr, opts);
		const id = navigator.geolocation.watchPosition(applyFix, onErr, opts);
		const poll = window.setInterval(() => {
			const s = useHelm.getState();
			if (!s.anchor && !s.activePassage) return;
			navigator.geolocation.getCurrentPosition(applyFix, onErr, opts);
		}, 15e3);
		return () => {
			navigator.geolocation.clearWatch(id);
			window.clearInterval(poll);
		};
	}, []);
}
function useDemoCruise() {
	const demoPlaying = useHelm((s) => s.demoPlaying);
	(0, import_react.useEffect)(() => {
		if (!demoPlaying) return;
		const active = useHelm.getState().activePassage;
		const pts = active && active.waypoints.length >= 2 ? active.waypoints : MUSGRAVE;
		let seg = 0;
		let t = 0;
		const tickMs = 80;
		const segTime = 2200;
		const id = window.setInterval(() => {
			const s = useHelm.getState();
			if (!s.demoPlaying) return;
			t += tickMs / segTime;
			if (t >= 1) {
				t = 0;
				seg += 1;
			}
			if (seg >= pts.length - 1) {
				const last = pts[pts.length - 1];
				s.setBoat({
					lat: last.lat,
					lng: last.lng,
					heading: s.boat?.heading ?? 120,
					speedMs: 0,
					accuracy: 6,
					source: "demo",
					at: Date.now()
				});
				s.setDemoPlaying(false);
				return;
			}
			const a = pts[seg];
			const b = pts[seg + 1];
			const lat = a.lat + (b.lat - a.lat) * t;
			const lng = a.lng + (b.lng - a.lng) * t;
			const heading = Math.atan2(b.lng - a.lng, b.lat - a.lat) * 180 / Math.PI;
			s.setBoat({
				lat,
				lng,
				heading: (heading + 360) % 360,
				speedMs: 4.2,
				accuracy: 5,
				source: "demo",
				at: Date.now()
			});
			if (s.drawMode === "record") {
				const last = s.draft[s.draft.length - 1];
				if (!last || haversineMeters(last, {
					lat,
					lng
				}) >= 12) s.appendDraft({
					lat,
					lng
				});
			}
		}, tickMs);
		return () => window.clearInterval(id);
	}, [demoPlaying]);
}
function useAnchorWatch() {
	const guard = (0, import_react.useRef)(freshGuard(Date.now(), true));
	const armed = useHelm((s) => Boolean(s.anchor || s.activePassage));
	(0, import_react.useEffect)(() => {
		if (armed) armWatchAlerts();
	}, [armed]);
	(0, import_react.useEffect)(() => {
		const onVis = () => tick();
		document.addEventListener("visibilitychange", onVis);
		const id = window.setInterval(tick, 1e3);
		tick();
		return () => {
			document.removeEventListener("visibilitychange", onVis);
			window.clearInterval(id);
			stopAlarmTone();
			clearWatchNotice();
		};
		function tick() {
			const s = useHelm.getState();
			const now = Date.now();
			const visible = document.visibilityState === "visible";
			const boat = s.boat;
			const anchor = s.anchor;
			const watchOn = Boolean(anchor) || Boolean(s.activePassage);
			const fresh = (boat ? now - boat.at : Infinity) < 2e4;
			const goodFix = Boolean(boat && boat.source !== "placed" && boat.source !== "none" && isGoodFix(boat.accuracy, boat.source) && fresh);
			const dragging = Boolean(fresh && boat && anchor && !boatInsideWatch(boat, anchor));
			const pts = s.activePassage ? passagePoints(s.activePassage) : [];
			const cue = boat && pts.length >= 2 ? steerCue(boat, pts, s.steerSense, s.xteAlarmM) : null;
			const { state, alarms } = stepGuard(guard.current, {
				now,
				visible,
				goodFix,
				fixAt: boat?.at,
				dragging: dragging && goodFix,
				offTrack: Boolean(cue?.offTrack) && goodFix && fresh,
				armed: watchOn
			});
			guard.current = state;
			if (s.alarmOn !== alarms.drag) s.setAlarmOn(alarms.drag);
			if (s.trackAlarm !== alarms.xte) s.setTrackAlarm(alarms.xte);
			if (s.gpsLost !== alarms.gpsLost) s.setGpsLost(alarms.gpsLost);
			const mobRing = Boolean(s.mob) && !s.mobMuted;
			const ringing = (alarms.drag || alarms.xte || alarms.gpsLost) && !s.alarmMuted;
			if (mobRing) {
				startAlarmTone(s.alarmSound);
				if (visible) unlockAlarmAudio();
				showWatchNotice("mob", "Man overboard. Steer back to the mark.");
			} else if (ringing) {
				startAlarmTone(s.alarmSound);
				if (visible) unlockAlarmAudio();
				if (alarms.drag) showWatchNotice("drag", "Outside the swing or barrier.");
				else if (alarms.xte) showWatchNotice("xte", "Vessel is off the track.");
				else showWatchNotice("gps", "No fix for more than 60 seconds.");
			} else {
				stopAlarmTone();
				clearWatchNotice();
			}
		}
	}, []);
}
function useMarkMade() {
	const prev = (0, import_react.useRef)(null);
	const toasted = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const tick = () => {
			const s = useHelm.getState();
			const pts = s.activePassage?.waypoints ?? [];
			if (!s.boat || pts.length < 2 || s.pinnedMark != null || s.mob) {
				prev.current = null;
				return;
			}
			const nav = markNav(s.boat, pts, null);
			if (!nav) return;
			if (prev.current != null && nav.index > prev.current && toasted.current !== prev.current) {
				const name = pts[prev.current]?.label?.trim() || `WP ${prev.current + 1}`;
				toast(`Made ${name}`);
				toasted.current = prev.current;
			}
			prev.current = nav.index;
		};
		const id = window.setInterval(tick, 1e3);
		return () => window.clearInterval(id);
	}, []);
}
function useWakeLock() {
	const keepAwake = useHelm((s) => s.look !== "normal" || Boolean(s.anchor) || Boolean(s.activePassage) || Boolean(s.mob) || s.demoPlaying);
	(0, import_react.useEffect)(() => {
		if (!keepAwake || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
		let released = false;
		let sentinel = null;
		const grab = async () => {
			try {
				sentinel = await navigator.wakeLock.request("screen");
			} catch {}
		};
		grab();
		const onVis = () => {
			if (!released && document.visibilityState === "visible") grab();
		};
		document.addEventListener("visibilitychange", onVis);
		return () => {
			released = true;
			document.removeEventListener("visibilitychange", onVis);
			sentinel?.release();
		};
	}, [keepAwake]);
}
function simulateAnchorDrag() {
	const s = useHelm.getState();
	if (!s.anchor) return;
	unlockAlarmAudio();
	const a = s.anchor;
	let lat = a.lat;
	let lng = a.lng;
	if (a.fence && a.fence.length >= 3) {
		const p = a.fence[0];
		lng = p.lng + .004;
		lat = p.lat;
	} else lng = a.lng + a.radiusM * 1.6 / (111320 * Math.cos(a.lat * Math.PI / 180));
	s.setFollowBoat(true);
	s.setBoat({
		lat,
		lng,
		heading: 90,
		speedMs: .4,
		accuracy: 4,
		source: "demo",
		at: Date.now()
	});
}
function startMusgraveDemo() {
	const s = useHelm.getState();
	s.setActivePassage({
		localId: "demo-musgrave",
		title: "Lady Musgrave lagoon entrance",
		region: "Great Barrier Reef",
		notes: "Time-compressed visual run of the north-west cut.",
		kind: "passage",
		waypoints: MUSGRAVE,
		savedAt: (/* @__PURE__ */ new Date()).toISOString()
	});
	const first = MUSGRAVE[0];
	s.setBoat({
		lat: first.lat,
		lng: first.lng,
		heading: 125,
		speedMs: 4,
		accuracy: 5,
		source: "demo",
		at: Date.now()
	});
	s.setFollowBoat(true);
	s.setDemoPlaying(true);
	window.setTimeout(() => {
		useHelm.getState().setPanel(null);
	}, 0);
}
function AuthSlot({ compact }) {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-9 shrink-0 animate-pulse rounded-md bg-muted" });
	if (user) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SignedIn, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: compact ? "size-9 overflow-hidden" : "hidden max-w-[10rem] truncate sm:block",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})
	}), compact ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "sm:hidden",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})
	})] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedOut, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
		asChild: true,
		variant: "helm",
		size: compact ? "icon-sm" : "sm",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/login",
			children: compact ? "In" : "Sign in"
		})
	}) });
}
function TopHud() {
	const boat = useHelm((s) => s.boat);
	const hull = useHelm((s) => s.hull);
	const follow = useHelm((s) => s.followBoat);
	const chartUp = useHelm((s) => s.chartUp);
	const tapMode = useHelm((s) => s.tapMode);
	const demo = useHelm((s) => s.demoPlaying);
	const gpsDenied = useHelm((s) => s.gpsDenied);
	const chartZoom = useHelm((s) => s.chartZoom);
	const look = useHelm((s) => s.look);
	const hookPreview = useHelm((s) => s.hookPreview);
	const fenceDraft = useHelm((s) => s.fenceDraft);
	const packDraft = useHelm((s) => s.packDraft);
	const cancelPlaceHook = useHelm((s) => s.cancelPlaceHook);
	const popFencePoint = useHelm((s) => s.popFencePoint);
	const popPackCorner = useHelm((s) => s.popPackCorner);
	const commitFence = useHelm((s) => s.commitFence);
	const setFollowBoat = useHelm((s) => s.setFollowBoat);
	const setChartUp = useHelm((s) => s.setChartUp);
	const setPanel = useHelm((s) => s.setPanel);
	const cycleLook = useHelm((s) => s.cycleLook);
	const mob = useHelm((s) => s.mob);
	const dropMob = useHelm((s) => s.dropMob);
	const src = boat?.source === "gps" ? "GPS" : boat?.source === "last" ? "LAST" : boat?.source === "demo" ? "DEMO" : boat?.source === "placed" ? "PLOT" : "NO FIX";
	const scale = formatGroundScale(boat?.lat ?? -23.9, chartZoom);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "pointer-events-none absolute inset-x-0 top-0 z-20 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-auto mx-auto hidden max-w-6xl items-center gap-2 md:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-[var(--shadow-border)] rp-glass",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-display text-lg leading-none font-semibold tracking-wide text-foreground",
									children: "ReefPilot"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-0.5 text-[11px] tracking-wide text-muted-foreground uppercase",
									children: "Satellite helm"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								variant: boat?.source === "gps" ? "default" : "muted",
								children: src
							}),
							demo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "Entrance run" }) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-1 items-stretch gap-px overflow-hidden rounded-xl border border-border bg-card/95 shadow-[var(--shadow-border)] rp-glass",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WindInstrument, {}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Instrument, {
								label: "LAT",
								value: boat ? formatLat(boat.lat) : "—",
								unit: "",
								wide: true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Instrument, {
								label: "LON",
								value: boat ? formatLng(boat.lng) : "—",
								unit: "",
								wide: true
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex items-center gap-2 rounded-xl border border-border bg-card/95 px-2 py-1.5 shadow-[var(--shadow-border)] rp-glass",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthSlot, {})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-auto mx-auto flex max-w-6xl items-stretch gap-1 md:hidden",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WindInstrument, { compact: true }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex shrink-0 flex-col justify-center rounded-lg border border-border bg-card/95 px-1.5 shadow-[var(--shadow-border)] rp-glass",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: boat?.source === "gps" ? "default" : "muted",
							children: src
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthSlot, { compact: true })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto mt-1.5 flex max-w-6xl justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pointer-events-auto flex flex-col gap-1.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: follow ? "default" : "helm",
							size: "icon",
							className: "size-10",
							"aria-label": "Follow boat",
							onClick: () => setFollowBoat(!follow),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LocateFixed, {})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: chartUp === "heading" ? "default" : "helm",
							size: "icon",
							className: "size-10",
							"aria-label": chartUp === "heading" ? "Heading up" : "North up",
							onClick: () => setChartUp(chartUp === "heading" ? "north" : "heading"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display text-sm font-bold leading-none",
								style: { transform: chartUp === "heading" && boat?.heading != null ? `rotate(${-boat.heading}deg)` : void 0 },
								children: "N"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: closeInOnBoat,
							"aria-label": "Helm scale",
							className: "rounded-md border border-border bg-card/95 px-1 py-1 text-center shadow-[var(--shadow-border)] rp-glass",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-[11px] leading-none font-semibold tabular-nums",
								children: scale
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: mob ? "danger" : "helm",
							size: "icon",
							className: "size-10",
							"aria-label": mob ? "Man overboard is marked" : "Man overboard",
							onClick: () => {
								if (mob) return;
								unlockAlarmAudio();
								if (!dropMob()) toast("Need a GPS fix before MOB.");
							},
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display text-[11px] font-bold leading-none",
								children: "MOB"
							})
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "pointer-events-auto flex flex-col gap-1.5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: look === "normal" ? "helm" : "default",
							size: "icon",
							className: "size-10",
							"aria-label": look === "night" ? "Night sailing colours. Tap for normal." : look === "sunlight" ? "Sunlight mode. Tap for night colours." : "Normal view. Tap for sunlight.",
							onClick: () => {
								const next = look === "normal" ? "sunlight" : look === "sunlight" ? "night" : "normal";
								cycleLook();
								if (next === "sunlight") {
									const el = document.documentElement;
									if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
								} else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
							},
							children: look === "night" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, {})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "helm",
							size: "icon",
							className: "size-10",
							"aria-label": "Boat",
							onClick: () => setPanel("boat"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ship, {})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "helm",
							size: "icon",
							className: "size-10",
							"aria-label": "Layers",
							onClick: () => setPanel("layers"),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Satellite, {})
						})
					]
				})]
			}),
			tapMode !== "none" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-auto mx-auto mt-1.5 flex max-w-6xl items-center gap-1.5 rounded-md bg-card/95 px-2 py-1.5 text-xs text-foreground shadow-[var(--shadow-border)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "min-w-0 flex-1 truncate",
						children: tapMode === "place-boat" ? "Tap to place the boat." : tapMode === "resize-swing" ? "Drag to set the swing radius. Lift to lock." : tapMode === "draw-fence" ? fenceDraft.length < 3 ? `Tap corners of the barrier (${fenceDraft.length}/3).` : "Tap the first mark to close, or Set." : tapMode === "draw-pack" ? packDraft.length === 0 ? "Tap one corner of the reef, then the opposite corner." : "Tap the opposite corner to close the box." : boat && hookPreview ? `Hook ${formatMeters(haversineMeters(bowFromGps(boat, boat.heading, hull), hookPreview))} — drag the ring, lift to set.` : "Drag to the sand where the hook went down."
					}),
					tapMode === "draw-pack" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						className: "h-8 shrink-0",
						disabled: packDraft.length === 0,
						onClick: popPackCorner,
						children: "Undo"
					}) : null,
					tapMode === "draw-fence" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						className: "h-8 shrink-0",
						disabled: fenceDraft.length === 0,
						onClick: popFencePoint,
						children: "Undo"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "default",
						size: "sm",
						className: "h-8 shrink-0",
						disabled: fenceDraft.length < 3,
						onClick: commitFence,
						children: "Set"
					})] }) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						className: "h-8 shrink-0",
						onClick: () => cancelPlaceHook(),
						children: "Cancel"
					})
				]
			}) : null,
			!boat && !gpsDenied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "pointer-events-none mx-auto mt-1.5 max-w-6xl text-center text-[11px] text-muted-foreground",
				children: "Locating GPS…"
			}) : null,
			!boat && gpsDenied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "pointer-events-none mx-auto mt-1.5 max-w-6xl text-center text-[11px] text-muted-foreground",
				children: "GPS off — Layers → Place boat."
			}) : null
		]
	});
}
function Instrument({ label, value, unit, wide, compact }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: compact ? "min-w-0 flex-1 px-2 py-1.5" : `px-3 py-2 ${wide ? "min-w-[9.5rem]" : "min-w-[4.5rem]"}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: `font-display leading-none font-semibold tabular-nums rp-instrument-value ${compact ? "text-lg" : "text-[1.35rem]"}`,
			children: [value, unit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "ml-0.5 text-[10px] font-medium text-muted-foreground",
				children: unit
			}) : null]
		})]
	});
}
function NextMarkHud() {
	const boat = useHelm((s) => s.boat);
	const passage = useHelm((s) => s.activePassage);
	const pinned = useHelm((s) => s.pinnedMark);
	const mob = useHelm((s) => s.mob);
	const setPinned = useHelm((s) => s.setPinnedMark);
	const panel = useHelm((s) => s.panel);
	const tapMode = useHelm((s) => s.tapMode);
	const pts = passage ? passage.waypoints : [];
	if (mob || !boat || pts.length < 1 || panel || tapMode !== "none") return null;
	const nav = markNav(boat, pts, pinned);
	if (!nav) return null;
	const brg = formatHeading(nav.bearing);
	const rng = formatMeters(nav.rangeM);
	const ttg = formatTtg(nav.ttgS);
	const sog = msToKnots(boat.speedMs);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 top-[18.8rem] z-20 px-12 md:top-[21.2rem] md:px-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => setPinned(nav.pinned ? null : nav.index),
			className: "pointer-events-auto mx-auto flex w-full max-w-md items-stretch overflow-hidden rounded-xl border border-border bg-card/95 shadow-[var(--shadow-border)] rp-glass",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1 px-3 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "truncate text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
						children: [
							nav.pinned ? "Locked" : nav.last ? "Arrive" : "Next",
							" · ",
							nav.label
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-1 grid grid-cols-3 gap-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
								children: "Brg"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-[1.35rem] leading-none font-semibold tabular-nums",
								children: brg
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
								children: "Rng"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-[1.35rem] leading-none font-semibold tabular-nums",
								children: rng
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
								children: "Ttg"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-[1.35rem] leading-none font-semibold tabular-nums",
								children: ttg
							})] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-[11px] text-muted-foreground",
						children: [sog < .4 ? "SOG too low for time · " : "", "tap a mark to lock"]
					})
				]
			})
		})
	});
}
function MobHud() {
	const boat = useHelm((s) => s.boat);
	const mob = useHelm((s) => s.mob);
	const clearMob = useHelm((s) => s.clearMob);
	const panel = useHelm((s) => s.panel);
	const tapMode = useHelm((s) => s.tapMode);
	if (!mob || panel || tapMode !== "none") return null;
	const rangeM = boat ? haversineMeters(boat, mob) : null;
	const brg = boat ? formatHeading(bearingDegrees(boat, mob)) : "—";
	const rng = rangeM != null ? formatMeters(rangeM) : "—";
	const sog = boat ? msToKnots(boat.speedMs) : 0;
	const ttg = boat && rangeM != null && sog >= .4 ? formatTtg(rangeM / (boat.speedMs || 1)) : "—";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 top-[18.8rem] z-20 px-2 md:top-[21.2rem] md:px-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto mx-auto flex w-full max-w-md items-stretch overflow-hidden rounded-xl border border-destructive bg-card/95 shadow-[var(--shadow-border)] rp-glass",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0 flex-1 px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "truncate text-[10px] tracking-[0.14em] text-destructive uppercase",
					children: "Back to MOB"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-1 grid grid-cols-3 gap-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
							children: "Brg"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-[1.4rem] leading-none font-semibold tabular-nums",
							children: brg
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
							children: "Rng"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-[1.4rem] leading-none font-semibold tabular-nums",
							children: rng
						})] }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
							children: "Ttg"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-[1.4rem] leading-none font-semibold tabular-nums",
							children: ttg
						})] })
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: clearMob,
				className: "shrink-0 border-l border-border px-3 text-xs font-semibold tracking-wide text-destructive uppercase",
				children: "Clear"
			})]
		})
	});
}
function NavRibbon() {
	const boat = useHelm((s) => s.boat);
	const passage = useHelm((s) => s.activePassage);
	const anchor = useHelm((s) => s.anchor);
	const alarmOn = useHelm((s) => s.alarmOn);
	const rode = useHelm((s) => s.rode);
	const hull = useHelm((s) => s.hull);
	const panel = useHelm((s) => s.panel);
	const tapMode = useHelm((s) => s.tapMode);
	const steerSense = useHelm((s) => s.steerSense);
	const xteAlarmM = useHelm((s) => s.xteAlarmM);
	const crumb = useHelm((s) => s.crumb);
	const reverseTrack = useHelm((s) => s.reverseTrack);
	const setPanel = useHelm((s) => s.setPanel);
	const math = rodeMath(rode, gpsReachM(hull));
	const canReverse = crumb.length >= 2 || passage != null && passage.waypoints.length >= 2;
	if (!passage && !anchor && !canReverse) return null;
	if (panel || tapMode !== "none") return null;
	const pts = passage ? passagePoints(passage) : [];
	const cue = boat && pts.length >= 2 ? steerCue(boat, pts, steerSense, xteAlarmM) : null;
	const remaining = cue ? formatMeters(cue.remainM) : null;
	const xte = cue && Math.abs(cue.xteM) >= 2 ? `${formatMeters(Math.abs(cue.xteM))} ${cue.xteM > 0 ? "stb" : "port"}` : "on track";
	const hook = boat && anchor ? haversineMeters(boat, anchor) : null;
	const fenced = Boolean(anchor?.fence && anchor.fence.length >= 3);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 bottom-[4.6rem] z-20 px-2 md:bottom-[9.2rem] md:px-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-6xl flex-wrap gap-1.5",
			children: [
				passage ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setPanel("passages"),
					className: "pointer-events-auto rounded-md border border-border bg-card/95 px-2 py-1 text-left shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-sm leading-none font-semibold",
						children: passage.title
					}), remaining ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 text-[11px] text-muted-foreground",
						children: [
							remaining,
							" · ",
							xte
						]
					}) : null]
				}) : null,
				canReverse ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => reverseTrack(),
					className: "pointer-events-auto rounded-md border border-border bg-card/95 px-2 py-1 text-left shadow-[var(--shadow-border)]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-sm leading-none font-semibold",
						children: "Reverse"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-[11px] text-muted-foreground",
						children: "Same water out"
					})]
				}) : null,
				anchor && hook != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setPanel("anchor"),
					className: `pointer-events-auto rounded-md border px-2 py-1 text-left shadow-[var(--shadow-border)] ${alarmOn ? "border-destructive bg-destructive text-white" : "border-border bg-card/95"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-sm leading-none font-semibold tabular-nums",
						children: fenced ? "Barrier" : `${formatMeters(hook)} / ${Math.round(anchor.radiusM)} m`
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: `mt-0.5 text-[11px] ${alarmOn ? "text-white/85" : math.status === "critical" ? "text-destructive" : "text-muted-foreground"}`,
						children: fenced ? alarmOn ? "Outside" : "Inside" : `${formatScope(math.scopeHw)} HW${math.shortHwM > .4 ? ` · +${Math.ceil(math.shortHwM)} m` : rode.tideHighAt ? ` · ${hoursUntil(rode.tideHighAt)}` : ""}`
					})]
				}) : null
			]
		})
	});
}
function AlarmOverlay() {
	const alarmOn = useHelm((s) => s.alarmOn);
	const trackAlarm = useHelm((s) => s.trackAlarm);
	const muted = useHelm((s) => s.alarmMuted);
	const boat = useHelm((s) => s.boat);
	const anchor = useHelm((s) => s.anchor);
	const passage = useHelm((s) => s.activePassage);
	const steerSense = useHelm((s) => s.steerSense);
	const xteAlarmM = useHelm((s) => s.xteAlarmM);
	const gpsLost = useHelm((s) => s.gpsLost);
	const setMuted = useHelm((s) => s.setAlarmMuted);
	const weigh = useHelm((s) => s.weighAnchor);
	const setActivePassage = useHelm((s) => s.setActivePassage);
	const mob = useHelm((s) => s.mob);
	const mobMuted = useHelm((s) => s.mobMuted);
	const setMobMuted = useHelm((s) => s.setMobMuted);
	const clearMob = useHelm((s) => s.clearMob);
	if (mob && !mobMuted) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex justify-center px-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rp-alarm pointer-events-auto w-full max-w-md rounded-xl border border-destructive bg-destructive px-4 py-3 text-white shadow-[var(--shadow-border)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "mt-0.5 size-5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-2xl leading-none font-semibold tracking-wide",
						children: "Man overboard"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-white/85",
						children: "Mark is where you tapped. Steer the bearing. It stays until you clear it."
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "secondary",
					onClick: () => setMobMuted(true),
					className: "bg-white text-destructive hover:bg-white/90",
					children: "Silence"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					onClick: clearMob,
					className: "border-white/40 bg-transparent text-white hover:bg-white/10",
					children: "Clear"
				})]
			})]
		})
	});
	if (alarmOn && anchor && boat) {
		const d = haversineMeters(boat, anchor);
		const fenced = Boolean(anchor.fence && anchor.fence.length >= 3);
		const over = d - anchor.radiusM;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "pointer-events-none absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex justify-center px-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rp-alarm pointer-events-auto w-full max-w-md rounded-xl border border-destructive bg-destructive px-4 py-3 text-white shadow-[var(--shadow-border)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "mt-0.5 size-5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-2xl leading-none font-semibold tracking-wide",
							children: "Anchor dragging"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-sm text-white/85",
							children: fenced ? "Outside the barrier" : `${formatMeters(over)} outside a ${Math.round(anchor.radiusM)} m circle`
						})]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 grid grid-cols-2 gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "secondary",
						onClick: () => setMuted(!muted),
						className: "bg-white text-destructive hover:bg-white/90",
						children: muted ? "Unmute" : "Silence"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						onClick: weigh,
						className: "border-white/40 bg-transparent text-white hover:bg-white/10",
						children: "Weigh"
					})]
				})]
			})
		});
	}
	if (gpsLost) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex justify-center px-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rp-alarm pointer-events-auto w-full max-w-md rounded-xl border border-destructive bg-destructive px-4 py-3 text-white shadow-[var(--shadow-border)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "mt-0.5 size-5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-2xl leading-none font-semibold tracking-wide",
						children: "GPS lost"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-white/85",
						children: "No good fix for more than 60 seconds. A short hole or the phone sleeping will not trip this."
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "secondary",
					onClick: () => setMuted(!muted),
					className: "bg-white text-destructive hover:bg-white/90",
					children: muted ? "Unmute" : "Silence"
				})
			})]
		})
	});
	if (!trackAlarm || !boat || !passage) return null;
	const cue = steerCue(boat, passagePoints(passage), steerSense, xteAlarmM);
	if (!cue) return null;
	const side = cue.xteM >= 0 ? "starboard" : "port";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex justify-center px-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "rp-alarm pointer-events-auto w-full max-w-md rounded-xl border border-destructive bg-destructive px-4 py-3 text-white shadow-[var(--shadow-border)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-start gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, { className: "mt-0.5 size-5 shrink-0" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-2xl leading-none font-semibold tracking-wide",
						children: "Off track"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-white/85",
						children: [
							formatMeters(Math.abs(cue.xteM)),
							" ",
							side,
							" of the line"
						]
					})]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "secondary",
					onClick: () => setMuted(!muted),
					className: "bg-white text-destructive hover:bg-white/90",
					children: muted ? "Unmute" : "Silence"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					onClick: () => setActivePassage(null),
					className: "border-white/40 bg-transparent text-white hover:bg-white/10",
					children: "Drop track"
				})]
			})]
		})
	});
}
function SteerOverlay() {
	const boat = useHelm((s) => s.boat);
	const passage = useHelm((s) => s.activePassage);
	const chartUp = useHelm((s) => s.chartUp);
	const tapMode = useHelm((s) => s.tapMode);
	const panel = useHelm((s) => s.panel);
	const sense = useHelm((s) => s.steerSense);
	const alarmM = useHelm((s) => s.xteAlarmM);
	const trackAlarm = useHelm((s) => s.trackAlarm);
	const wx = useWx();
	if (!boat || tapMode !== "none" || panel === "weather") return null;
	const pts = passage ? passagePoints(passage) : [];
	const cue = pts.length >= 2 ? steerCue(boat, pts, sense, alarmM) : null;
	const sog = msToKnots(boat.speedMs);
	const cog = boat.heading;
	const xte = formatXte(cue?.xteM);
	const onLine = Boolean(cue && Math.abs(cue.xteM) < 4 && Math.abs(cue.steerDeg) < 6);
	const tone = cue && (cue.offTrack || trackAlarm) ? "danger" : onLine ? "ok" : cue ? "warn" : "ok";
	const showArrow = chartUp === "heading" && cue && boat.heading != null;
	const sogLabel = Number.isFinite(sog) ? sog.toFixed(1) : "—";
	const ctsLabel = cue ? formatHeading(cue.cts) : "—";
	const sea = wx.data?.sea;
	const allow = cue && sea?.currentKn != null && sea.currentDir != null ? setAllowance(cue.cts, sog, sea.currentKn, sea.currentDir) : null;
	const xteAria = xte.side === "S" ? `${xte.value.replace("S", "")} metres starboard` : xte.side === "P" ? `${xte.value.replace("P", "")} metres port` : xte.value === "0" ? "on track" : "no track";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 top-[4.35rem] z-[15] px-12 md:top-[6.15rem] md:px-3",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: `rp-steer rp-steer-${tone} mx-auto flex w-full max-w-lg flex-col items-center md:max-w-2xl`,
			"aria-label": `Speed ${sogLabel} knots. Cross-track ${xteAria}. Course to steer ${ctsLabel}${allow ? `. Allow ${allow.deg} degrees ${allow.side === "P" ? "port" : "starboard"} for set` : ""}.`,
			children: [showArrow ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rp-steer-bug",
				style: { transform: `rotate(${cue.steerDeg}deg)` },
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
					viewBox: "0 0 64 72",
					className: "rp-steer-bug-svg",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M32 4 L56 44 L40 44 L40 68 L24 68 L24 44 L8 44 Z" })
				})
			}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rp-helm-tape rp-glass mt-0.5 grid w-full grid-cols-3 md:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HelmNum, {
						className: "hidden md:flex",
						label: "COG",
						value: formatHeading(cog)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HelmNum, {
						label: "SOG",
						value: sogLabel,
						unit: "kn"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HelmNum, {
						label: "XTE",
						value: xte.value,
						unit: xte.unit || void 0,
						warn: Boolean(cue?.offTrack || trackAlarm)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HelmNum, {
						label: "CTS",
						value: ctsLabel,
						unit: allow ? `${allow.deg}° ${allow.side}` : void 0
					})
				]
			})]
		})
	});
}
function HelmNum({ label, value, unit, warn, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex min-w-0 flex-col items-center px-1 py-1.5", className),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rp-helm-label font-semibold tracking-[0.18em] text-muted-foreground uppercase",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: cn("rp-helm-num font-display font-bold tabular-nums leading-none", warn && "rp-helm-warn"),
				children: value
			}),
			unit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rp-helm-unit mt-0.5 font-semibold tracking-wide text-muted-foreground uppercase",
				children: unit
			}) : null
		]
	});
}
function Disclaimer() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "pointer-events-none absolute bottom-4 left-3 z-10 hidden max-w-[16rem] text-[10px] leading-snug text-foreground/80 md:block",
		children: "Not a carriage chart. Satellite + OpenSeaMap are lookout aids."
	});
}
function Input({ className, type, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
		type,
		className: cn("flex h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-[var(--shadow-border)] transition-[box-shadow] duration-[var(--motion-quick)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40", className),
		...props
	});
}
var waypointSchema = object({
	lat: number().gte(-90).lte(90),
	lng: number().gte(-180).lte(180),
	label: string().max(48).optional()
});
var saveSchema = object({
	title: string().trim().min(2).max(80),
	region: string().trim().max(80).default(""),
	notes: string().trim().max(600).default(""),
	kind: _enum(["passage", "anchorage"]),
	published: boolean(),
	waypoints: array(waypointSchema).min(1).max(200),
	authorName: string().trim().min(1).max(48)
});
var listPublicPassages = createServerFn({ method: "GET" }).handler(createSsrRpc("917833e6c7e1510ba5ce3b096fbb266796d2eacfe68f76ff22ae3ed3ddebcc69"));
var getPublicPassage = createServerFn({ method: "GET" }).validator(object({ id: number().int().positive() })).handler(createSsrRpc("5ad2f883ad140e35b2ae25fe6397048cb6529994bfe84129f66cc9a94c008c2c"));
var listMyPassages = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("2d32e78a295e4782e60b6a50131b28856f9d9bbaa11eadc6925a94d5be2a395e"));
var savePassage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(saveSchema).handler(createSsrRpc("518e0dce2d38a263f2e3432f0ca55d0dc284f609e3db1246f1457699bd938f98"));
var setPublished = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({
	id: number().int().positive(),
	published: boolean()
})).handler(createSsrRpc("7286ffce45e4fd60e6128f6531c7c263a7dc046e87272173582404023676438e"));
var deletePassage = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator(object({ id: number().int().positive() })).handler(createSsrRpc("e34249cc90045619ca66c78320657674454f9f203a09fdaeeec817e4ca92c0aa"));
function Sheet$1({ id, title, kicker, children }) {
	const panel = useHelm((s) => s.panel);
	const setPanel = useHelm((s) => s.setPanel);
	if (panel !== id) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 bottom-0 z-30 md:inset-y-20 md:right-3 md:bottom-24 md:left-auto md:w-[22rem]",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto max-h-[min(46vh,24rem)] overflow-y-auto rounded-t-xl border border-border bg-card px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border)] md:max-h-[min(72vh,36rem)] md:rounded-xl md:p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto mb-1.5 h-1 w-10 rounded-full bg-border md:hidden" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2 flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [kicker ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[9px] tracking-[0.14em] text-muted-foreground uppercase",
							children: kicker
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl leading-none font-semibold tracking-tight",
							children: title
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						className: "h-8",
						onClick: () => setPanel(null),
						children: "Close"
					})]
				}),
				children
			]
		})
	});
}
function roundStep$1(n, step) {
	const s = step || 1;
	return Math.round(n / s) * s;
}
function formatStep$1(n, step) {
	if (step < 1) return n.toFixed(1);
	return String(Math.round(n * 10) / 10);
}
function StepField$1({ label, value, step = 1, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-background px-2 py-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-0.5 flex items-center gap-1.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					size: "icon-sm",
					onClick: () => onChange(Math.max(0, roundStep$1(value - step, step))),
					"aria-label": `Decrease ${label}`,
					children: "−"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display flex-1 text-center text-xl font-semibold tabular-nums",
					children: formatStep$1(value, step)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					size: "icon-sm",
					onClick: () => onChange(roundStep$1(value + step, step)),
					"aria-label": `Increase ${label}`,
					children: "+"
				})
			]
		})]
	});
}
function ToggleRow({ label, on, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick: () => onChange(!on),
		className: "flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-left",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: `text-[11px] font-semibold tracking-wide uppercase ${on ? "text-primary" : "text-muted-foreground"}`,
			children: on ? "On" : "Off"
		})]
	});
}
function AnchorPanel() {
	const boat = useHelm((s) => s.boat);
	const anchor = useHelm((s) => s.anchor);
	const alarmOn = useHelm((s) => s.alarmOn);
	const gpsLost = useHelm((s) => s.gpsLost);
	const muted = useHelm((s) => s.alarmMuted);
	const weigh = useHelm((s) => s.weighAnchor);
	const startPlaceHook = useHelm((s) => s.startPlaceHook);
	const startResizeSwing = useHelm((s) => s.startResizeSwing);
	const startDrawFence = useHelm((s) => s.startDrawFence);
	const clearFence = useHelm((s) => s.clearFence);
	const setMuted = useHelm((s) => s.setAlarmMuted);
	const rode = useHelm((s) => s.rode);
	const swingTrailOn = useHelm((s) => s.swingTrailOn);
	const setSwingTrailOn = useHelm((s) => s.setSwingTrailOn);
	const setRode = useHelm((s) => s.setRode);
	const hull = useHelm((s) => s.hull);
	const setPanel = useHelm((s) => s.setPanel);
	const alarmSound = useHelm((s) => s.alarmSound);
	const setAlarmSound = useHelm((s) => s.setAlarmSound);
	const bow = boat ? bowFromGps(boat, boat.heading, hull) : null;
	const distM = bow && anchor ? haversineMeters(bow, anchor) : 0;
	const dist = bow && anchor ? formatMeters(distM) : null;
	const math = rodeMath(rode, gpsReachM(hull));
	const loc = anchor ?? boat;
	const pay = suggestedPayOutM(rode, math);
	const letMoreM = Math.round((pay - rode.chainM) * 10) / 10;
	const tide = useQuery({
		queryKey: [
			"tide-rise",
			loc?.lat.toFixed(3),
			loc?.lng.toFixed(3)
		],
		queryFn: () => fetchTideRise(loc.lat, loc.lng),
		enabled: Boolean(loc),
		staleTime: 18e5,
		retry: 1
	});
	(0, import_react.useEffect)(() => {
		if (!tide.data || rode.tideManual) return;
		const d = tide.data;
		if (Math.abs(rode.tideRiseM - d.riseM) < .05 && rode.tideHighAt === d.highAt) return;
		setRode({
			tideRiseM: d.riseM,
			tideHighAt: d.highAt,
			tideManual: false
		});
	}, [
		tide.data,
		rode.tideManual,
		rode.tideRiseM,
		rode.tideHighAt,
		setRode
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Sheet$1, {
		id: "anchor",
		title: "Anchor",
		kicker: "Mark the hook",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-2 text-xs text-pretty text-muted-foreground",
				children: "Boat is the fallen-back position. Chain from the bow. Set depth and chain, then drag to the hook."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepField$1, {
					label: "Depth m",
					value: rode.depthM,
					step: .5,
					onChange: (n) => setRode({ depthM: n })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepField$1, {
					label: "Chain out m",
					value: rode.chainM,
					step: 5,
					onChange: (n) => setRode({ chainM: n })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 rounded-lg border border-border bg-background px-3 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-baseline justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
						children: "Layback"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-display text-2xl font-semibold tabular-nums",
						children: [Math.round(math.laybackM), " m"]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-0.5 text-[11px] text-muted-foreground",
					children: [
						"Chain on the sand: ",
						rode.chainM,
						" m − ",
						rode.depthM.toFixed(1),
						" m − ",
						rode.bowM.toFixed(1),
						" m bow. Taut swing ",
						math.radiusM,
						" m."
					]
				})]
			}),
			boat || anchor ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnchorWxCard, {}) : null,
			anchor ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 grid gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
							children: "Distance"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-display text-xl font-semibold tabular-nums",
							children: [dist ?? "—", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-1 text-xs font-medium text-muted-foreground",
								children: Math.abs(distM - math.laybackM) <= 8 ? "on rode" : `want ${Math.round(math.laybackM)} m`
							})]
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							variant: alarmOn || gpsLost ? "danger" : "holding",
							children: alarmOn ? "Dragging" : gpsLost ? "GPS lost" : "Holding"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
						label: "Swing trail",
						on: swingTrailOn,
						onChange: setSwingTrailOn
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[11px] leading-snug text-muted-foreground",
						children: "Watch stays on if you sleep the phone or open another app. It will not alarm for that. GPS lost only after 60 s with no fix, not a brief hole. Allow notifications when asked."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "outline",
								size: "sm",
								onClick: () => startPlaceHook(),
								children: "Move hook"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "outline",
								size: "sm",
								onClick: () => {
									unlockAlarmAudio();
									startResizeSwing();
								},
								children: "Swing size"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "outline",
								size: "sm",
								onClick: () => startDrawFence(),
								children: "Draw barrier"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "outline",
								size: "sm",
								disabled: !anchor.fence,
								onClick: () => clearFence(),
								children: "Clear barrier"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "outline",
							size: "sm",
							onClick: () => setMuted(!muted),
							children: muted ? "Unmute" : "Silence"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "danger",
							size: "sm",
							onClick: weigh,
							children: "Weigh"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						onClick: () => simulateAnchorDrag(),
						children: "Test drag alarm"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
						children: "Alarm"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-3 gap-1.5",
						children: ALARM_SOUNDS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: alarmSound === s.id ? "default" : "outline",
							size: "sm",
							onClick: () => {
								setAlarmSound(s.id);
								previewAlarm(s.id);
							},
							children: s.name
						}, s.id))
					}),
					math.shortHwM > .4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-destructive",
						children: [
							"Short of ",
							formatScope(rode.scopeTarget),
							" at HW",
							letMoreM > 0 ? ` — pay ${letMoreM} m more` : "",
							".",
							rode.tideHighAt ? ` High ${hoursUntil(rode.tideHighAt)}.` : ""
						]
					}) : null
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "w-full",
				onClick: () => {
					unlockAlarmAudio();
					startPlaceHook();
				},
				children: "Set hook"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setPanel("boat"),
				className: "mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
					children: "Hull · GPS"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-sm font-semibold",
					children: gpsStationLabel(hull)
				})]
			})
		]
	});
}
function AtlasPanel() {
	const reefId = useHelm((s) => s.reefId);
	const setReef = useHelm((s) => s.setReef);
	const packs = useHelm((s) => s.offlinePacks);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Sheet$1, {
		id: "atlas",
		title: "Reef atlas",
		kicker: "Cuts and lagoons",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-3 text-sm text-muted-foreground",
				children: "Jump a known cut. Colour of water is the chart — dark is deep, brown is coral, pale is sand. Green means this reef is on the phone."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				className: "mb-3 w-full",
				onClick: startMusgraveDemo,
				children: "Run Lady Musgrave entrance"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "grid gap-2",
				children: REEFS.map((r) => {
					const onPhone = Boolean(packOnPhone(packs, r.lat, r.lng));
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setReef(r.id),
						className: `w-full rounded-lg border px-3 py-3 text-left ${reefId === r.id ? "border-primary bg-primary/10" : "border-border bg-background"}`,
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-display text-lg leading-none font-semibold",
									children: r.name
								}), onPhone ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-400 uppercase",
									children: "On phone"
								}) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-xs text-muted-foreground",
								children: [
									r.region,
									" · ",
									r.country
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-pretty text-muted-foreground",
								children: r.blurb
							})
						]
					}) }, r.id);
				})
			})
		]
	});
}
function LayersPanel() {
	const imagery = useHelm((s) => s.imagery);
	const setImagery = useHelm((s) => s.setImagery);
	const labels = useHelm((s) => s.labels);
	const setLabels = useHelm((s) => s.setLabels);
	const seamarks = useHelm((s) => s.seamarks);
	const setSeamarks = useHelm((s) => s.setSeamarks);
	const depths = useHelm((s) => s.depths);
	const setDepths = useHelm((s) => s.setDepths);
	const crumbOn = useHelm((s) => s.crumbOn);
	const setCrumbOn = useHelm((s) => s.setCrumbOn);
	const crumb = useHelm((s) => s.crumb);
	const clearCrumb = useHelm((s) => s.clearCrumb);
	const reverseTrack = useHelm((s) => s.reverseTrack);
	const look = useHelm((s) => s.look);
	const setLook = useHelm((s) => s.setLook);
	const sunPunch = useHelm((s) => s.sunPunch);
	const setSunPunch = useHelm((s) => s.setSunPunch);
	const tapMode = useHelm((s) => s.tapMode);
	const setTapMode = useHelm((s) => s.setTapMode);
	const setPanel = useHelm((s) => s.setPanel);
	const chartUp = useHelm((s) => s.chartUp);
	const setChartUp = useHelm((s) => s.setChartUp);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Sheet$1, {
		id: "layers",
		title: "Imagery",
		kicker: "Never blank",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: chartUp === "north" ? "default" : "outline",
					size: "sm",
					onClick: () => setChartUp("north"),
					children: "North up"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: chartUp === "heading" ? "default" : "outline",
					size: "sm",
					onClick: () => setChartUp("heading"),
					children: "Heading up"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-2 text-[11px] leading-snug text-muted-foreground",
				children: "Heading up turns the chart so the bow points up the screen — best on a track. Needs a GPS course; at rest it stays north-up."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfflinePacks, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TrackSteerSettings, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 grid grid-cols-2 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						onClick: () => {
							setTapMode(tapMode === "place-boat" ? "none" : "place-boat");
							setPanel(null);
						},
						children: "Place boat"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						onClick: () => setPanel("boat"),
						children: "Boat"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "outline",
						size: "sm",
						onClick: () => setPanel("legend"),
						children: "Read water"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-2 grid gap-1.5",
				children: IMAGERY.map((im) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setImagery(im.id),
					className: `rounded-md border px-3 py-2 text-left ${imagery === im.id ? "border-primary bg-primary/10" : "border-border bg-background"}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-base leading-none font-semibold",
						children: im.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[11px] text-pretty text-muted-foreground",
						children: im.detail
					})]
				}, im.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 grid gap-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
						label: "Place names",
						on: labels,
						onChange: setLabels
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
						label: "Seamarks",
						on: seamarks,
						onChange: setSeamarks
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
						label: "Depth contours",
						on: depths,
						onChange: setDepths
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ToggleRow, {
						label: "Breadcrumb",
						on: crumbOn,
						onChange: setCrumbOn
					})
				]
			}),
			crumb.length >= 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					size: "sm",
					onClick: () => reverseTrack(),
					children: "Reverse trail"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					size: "sm",
					onClick: () => clearCrumb(),
					children: "Clear trail"
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-1.5 text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
				children: "Look"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-2 grid grid-cols-3 gap-2",
				children: [
					["normal", "Normal"],
					["sunlight", "Sun"],
					["night", "Night"]
				].map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: look === id ? "default" : "outline",
					size: "sm",
					onClick: () => setLook(id),
					children: label
				}, id))
			}),
			look === "sunlight" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-2 grid grid-cols-3 gap-2",
				children: [
					1,
					2,
					3
				].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: sunPunch === n ? "default" : "outline",
					size: "sm",
					onClick: () => setSunPunch(n),
					children: ["Punch ", n]
				}, n))
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-[11px] leading-snug text-muted-foreground",
				children: [
					"OpenSeaMap marks and depth contours sit over the satellite. Official Navionics tiles need Garmin’s native marine SDK — there is no web login that unlocks them here.",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
						href: GARMIN_SDK_URL,
						target: "_blank",
						rel: "noreferrer",
						className: "underline underline-offset-2",
						children: "Garmin marine SDK"
					})
				]
			})
		]
	});
}
function OfflinePacks() {
	const boat = useHelm((s) => s.boat);
	const packBox = useHelm((s) => s.packBox);
	const packs = useHelm((s) => s.offlinePacks);
	const setPacks = useHelm((s) => s.setOfflinePacks);
	const setPackBox = useHelm((s) => s.setPackBox);
	const startDrawPack = useHelm((s) => s.startDrawPack);
	const fly = useHelm((s) => s.fly);
	const [maxZ, setMaxZ] = (0, import_react.useState)(18);
	const [name, setName] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [progress, setProgress] = (0, import_react.useState)(null);
	const refresh = () => {
		listPacks().then(setPacks);
	};
	(0, import_react.useEffect)(() => {
		refresh();
	}, []);
	(0, import_react.useEffect)(() => {
		if (!packBox) return;
		setName(packName(packBox));
	}, [packBox]);
	const box = packBox;
	const est = box ? estimatePack(box, maxZ) : null;
	const here = boat ? packOnPhone(packs, boat.lat, boat.lng) : null;
	const run = async () => {
		if (!box || !est || est.tooWide) return;
		setBusy(true);
		setProgress({
			done: 0,
			total: 1,
			bytes: 0
		});
		try {
			await downloadPack(box, maxZ, name.trim() || packName(box), setProgress);
			toast.success(`${name.trim() || packName(box)} on this phone`);
			setPackBox(null);
			refresh();
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Download stopped";
			if (msg !== "cancelled" && !/AbortError/.test(String(err))) toast.error(msg);
		} finally {
			setBusy(false);
			setProgress(null);
		}
	};
	const useReef = (lat, lng, reefName, radiusM) => {
		const b = boxAround({
			lat,
			lng
		}, radiusM);
		setPackBox(b);
		setName(reefName);
		fly(lat, lng, 16);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-2 rounded-lg border border-border bg-background px-2.5 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
					children: "Offline packs"
				}), here ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-emerald-400 uppercase",
					children: "On phone"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-[10px] text-muted-foreground",
					children: "Not on phone"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 text-[11px] leading-snug text-muted-foreground",
				children: "Draw a box around the reef, pick z16–19, see the size, then download. Green = this water is in the phone."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1.5 grid grid-cols-2 gap-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					size: "sm",
					disabled: busy,
					onClick: () => startDrawPack(),
					children: "Draw box"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					size: "sm",
					disabled: busy,
					onClick: () => useReef(-23.904, 152.395, "Lady Musgrave", 2200),
					children: "Lady Musgrave"
				})]
			}),
			box && est ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 grid gap-1.5 rounded-md border border-border px-2 py-1.5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "grid gap-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
							children: "Name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: name,
							onChange: (e) => setName(e.target.value),
							className: "h-8"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
						children: "Close-up zoom"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-4 gap-1",
						children: PACK_ZOOMS.map((z) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: maxZ === z ? "default" : "outline",
							size: "sm",
							className: "h-8",
							onClick: () => setMaxZ(z),
							children: ["z", z]
						}, z))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[11px] tabular-nums text-muted-foreground",
						children: [
							est.km.toFixed(1),
							" km · z16–",
							est.maxZ,
							" · ",
							est.tiles.toLocaleString(),
							" tiles · ",
							formatBytes(est.bytes),
							est.tooWide ? " — box too big" : ""
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							disabled: busy || est.tooWide,
							onClick: () => void run(),
							children: "Download"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "sm",
							disabled: busy,
							onClick: () => setPackBox(null),
							children: "Clear box"
						})]
					})
				]
			}) : null,
			busy && progress ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1.5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-1.5 overflow-hidden rounded-full bg-muted",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-full bg-primary",
						style: { width: `${Math.round(progress.done / Math.max(1, progress.total) * 100)}%` }
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-1 flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[11px] tabular-nums text-muted-foreground",
						children: [
							progress.done,
							"/",
							progress.total,
							" · ",
							formatBytes(progress.bytes)
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						className: "h-7",
						onClick: () => cancelPackDownload(),
						children: "Cancel"
					})]
				})]
			}) : null,
			packs.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-1.5 grid gap-1",
				children: packs.map((p) => {
					const on = Boolean(boat && packOnPhone([p], boat.lat, boat.lng));
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: `flex items-center justify-between gap-2 rounded-md border px-2 py-1 ${on ? "border-emerald-500/50 bg-emerald-500/10" : "border-border"}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "min-w-0 flex-1 truncate text-left text-xs",
							onClick: () => fly((p.bounds.south + p.bounds.north) / 2, (p.bounds.west + p.bounds.east) / 2, Math.min(18, p.maxZ)),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: on ? "text-emerald-400" : "",
								children: p.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "ml-1 text-muted-foreground",
								children: [
									"z",
									p.maxZ,
									" · ",
									formatBytes(p.bytes),
									on ? " · here" : ""
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "sm",
							className: "h-7 shrink-0",
							disabled: busy,
							onClick: () => {
								deletePack(p.id).then(() => {
									refresh();
									toast.message("Pack removed");
								});
							},
							children: "Delete"
						})]
					}, p.id);
				})
			}) : null
		]
	});
}
function TrackSteerSettings() {
	const sense = useHelm((s) => s.steerSense);
	const setSense = useHelm((s) => s.setSteerSense);
	const alarmM = useHelm((s) => s.xteAlarmM);
	const setAlarmM = useHelm((s) => s.setXteAlarmM);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-2 rounded-lg border border-border bg-background px-2.5 py-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
				children: "Track steer"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1.5 grid grid-cols-3 gap-1.5",
				children: Object.keys(STEER_PRESETS).map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: sense === id ? "default" : "outline",
					size: "sm",
					onClick: () => setSense(id),
					children: STEER_PRESETS[id].label
				}, id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1.5 text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
				children: "Off-track alarm"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 grid grid-cols-5 gap-1",
				children: XTE_ALARM_PRESETS.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					variant: alarmM === m ? "default" : "outline",
					size: "sm",
					className: "h-8",
					onClick: () => setAlarmM(m),
					children: [m, " m"]
				}, m))
			})
		]
	});
}
function LegendPanel() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Sheet$1, {
		id: "legend",
		title: "Read the water",
		kicker: "Colour is the chart",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
			className: "grid gap-3 text-sm",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-lg font-semibold",
					children: "Deep indigo / navy"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground",
					children: "Deep water and the cut. Stay in the dark when entering a lagoon."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-lg font-semibold",
					children: "Brown / olive"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground",
					children: "Living coral and bommies. Do not cross. Give it a boat-length."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-lg font-semibold",
					children: "Pale aqua / white"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground",
					children: "Sand. The hook belongs here, inside the lagoon or off the lee of a cay."
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-lg font-semibold",
					children: "Turquoise over brown"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-muted-foreground",
					children: "Shallow reef flat. Fine in the dinghy, not under the keel."
				})] })
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-4 text-xs text-muted-foreground",
			children: "Not a carriage chart. Satellite is a lookout aid — confirm with the sounder and your eyes."
		})]
	});
}
function SavePanel() {
	const draft = useHelm((s) => s.draft);
	const saveDraft = useHelm((s) => s.saveDraft);
	const setDrawMode = useHelm((s) => s.setDrawMode);
	const { user } = useCurrentUserState();
	const [title, setTitle] = (0, import_react.useState)("Untitled cut");
	const [region, setRegion] = (0, import_react.useState)("");
	const [notes, setNotes] = (0, import_react.useState)("");
	const [kind, setKind] = (0, import_react.useState)("passage");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const len = pathLengthMeters(draft);
	const local = () => {
		const saved = saveDraft({
			title: title.trim() || "Untitled cut",
			region,
			notes,
			kind,
			waypoints: draft
		});
		toast(`Saved ${saved.title}`);
	};
	const publish = async () => {
		if (!user) return;
		setBusy(true);
		try {
			await savePassage({ data: {
				title: title.trim() || "Untitled cut",
				region,
				notes,
				kind,
				published: true,
				waypoints: draft,
				authorName: user.displayName || "Skipper"
			} });
			saveDraft({
				title: title.trim() || "Untitled cut",
				region,
				notes,
				kind,
				waypoints: draft
			});
			toast("Published to the library");
		} catch {
			toast("Could not publish — saved on this helm only");
			local();
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet$1, {
		id: "save",
		title: "Save track",
		kicker: `${draft.length} marks · ${formatMeters(len)}`,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "grid gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
						children: "Title"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: title,
						onChange: (e) => setTitle(e.target.value)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "grid gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
						children: "Region"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: region,
						onChange: (e) => setRegion(e.target.value),
						placeholder: "Great Barrier Reef"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "grid gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
						children: "Notes"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: notes,
						onChange: (e) => setNotes(e.target.value)
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid grid-cols-2 gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: kind === "passage" ? "default" : "outline",
						onClick: () => setKind("passage"),
						children: "Passage"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: kind === "anchorage" ? "default" : "outline",
						onClick: () => setKind("anchorage"),
						children: "Anchorage"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					onClick: local,
					disabled: draft.length < 1,
					children: "Save on this helm"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedIn, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					disabled: busy || draft.length < 1,
					onClick: () => void publish(),
					children: busy ? "Publishing…" : "Publish to library"
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedOut, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					asChild: true,
					variant: "outline",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/login",
						children: "Sign in to publish"
					})
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					onClick: () => setDrawMode("idle"),
					children: "Discard"
				})
			]
		})
	});
}
function PassagesPanel() {
	const drafts = useHelm((s) => s.drafts);
	const active = useHelm((s) => s.activePassage);
	const setActive = useHelm((s) => s.setActivePassage);
	const removeDraft = useHelm((s) => s.removeDraft);
	const reverseTrack = useHelm((s) => s.reverseTrack);
	const { user } = useCurrentUserState();
	const pub = useQuery({
		queryKey: ["passages-public"],
		queryFn: () => listPublicPassages(),
		staleTime: 6e4
	});
	const mine = useQuery({
		queryKey: ["passages-mine", user?.id],
		queryFn: () => listMyPassages(),
		enabled: Boolean(user),
		staleTime: 3e4
	});
	const follow = (p) => {
		setActive(p);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Sheet$1, {
		id: "passages",
		title: "Tracks",
		kicker: "Cuts to follow",
		children: [
			active ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 grid grid-cols-2 gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					size: "sm",
					onClick: () => reverseTrack(),
					children: "Reverse"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					size: "sm",
					onClick: () => setActive(null),
					children: "Drop track"
				})]
			}) : null,
			drafts.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
					children: "On this helm"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "grid gap-1.5",
					children: drafts.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-2 rounded-md border border-border px-2 py-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "min-w-0 flex-1 text-left",
							onClick: () => follow(d),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "truncate text-sm font-medium",
								children: d.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-[11px] text-muted-foreground",
								children: [d.waypoints.length, " marks"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							size: "sm",
							className: "h-7",
							onClick: () => removeDraft(d.localId),
							children: "Del"
						})]
					}, d.localId))
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedIn, { children: mine.data?.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mb-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
					children: "Mine"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "grid gap-1.5",
					children: mine.data.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center gap-2 rounded-md border border-border px-2 py-1.5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "min-w-0 flex-1 text-left",
								onClick: () => follow(p),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "truncate text-sm font-medium",
									children: p.title
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-[11px] text-muted-foreground",
									children: p.published ? "Public" : "Private"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "sm",
								className: "h-7",
								onClick: () => {
									setPublished({ data: {
										id: p.id,
										published: !p.published
									} }).then(() => mine.refetch());
								},
								children: p.published ? "Hide" : "Share"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "ghost",
								size: "sm",
								className: "h-7",
								onClick: () => {
									deletePassage({ data: { id: p.id } }).then(() => mine.refetch());
								},
								children: "Del"
							})
						]
					}, p.id))
				})]
			}) : null }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-1 text-[10px] tracking-[0.14em] text-muted-foreground uppercase",
				children: "Library"
			}),
			pub.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: "Loading cuts…"
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "grid gap-1.5",
				children: (pub.data ?? []).map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => follow(p),
					className: "w-full rounded-md border border-border px-2 py-1.5 text-left",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate text-sm font-medium",
						children: p.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-[11px] text-muted-foreground",
						children: [
							p.region || p.authorName,
							" · ",
							p.waypoints.length,
							" marks"
						]
					})]
				}) }, p.id))
			})
		]
	});
}
function Sheet({ id, title, kicker, children }) {
	const panel = useHelm((s) => s.panel);
	const setPanel = useHelm((s) => s.setPanel);
	if (panel !== id) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "pointer-events-none absolute inset-x-0 bottom-0 z-30 md:inset-y-20 md:right-3 md:bottom-24 md:left-auto md:w-[22rem]",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "pointer-events-auto max-h-[min(58vh,32rem)] overflow-y-auto rounded-t-xl border border-border bg-card px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border)] md:max-h-[min(72vh,36rem)] md:rounded-xl md:p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto mb-1.5 h-1 w-10 rounded-full bg-border md:hidden" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2 flex items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [kicker ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[9px] tracking-[0.14em] text-muted-foreground uppercase",
							children: kicker
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-xl leading-none font-semibold tracking-tight",
							children: title
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						size: "sm",
						className: "h-8",
						onClick: () => setPanel(null),
						children: "Close"
					})]
				}),
				children
			]
		})
	});
}
function roundStep(n, step) {
	const s = step || 1;
	return Math.round(n / s) * s;
}
function formatStep(n, step) {
	if (step < 1) return n.toFixed(1);
	return String(Math.round(n * 10) / 10);
}
function StepField({ label, value, step = 1, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-background px-2 py-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-0.5 flex items-center gap-1.5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					size: "icon-sm",
					onClick: () => onChange(Math.max(0, roundStep(value - step, step))),
					"aria-label": `Decrease ${label}`,
					children: "−"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display flex-1 text-center text-xl font-semibold tabular-nums",
					children: formatStep(value, step)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "outline",
					size: "icon-sm",
					onClick: () => onChange(roundStep(value + step, step)),
					"aria-label": `Increase ${label}`,
					children: "+"
				})
			]
		})]
	});
}
function BoatPlan() {
	const hull = useHelm((s) => s.hull);
	const setHull = useHelm((s) => s.setHull);
	const svgRef = (0, import_react.useRef)(null);
	const mark = (clientX, clientY) => {
		const el = svgRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		setHull(stationFromTap(clientX - r.left, clientY - r.top, r.width, r.height, hull));
	};
	const gx = Math.max(12, Math.min(88, 50 + hull.gpsFromCenterM / Math.max(.4, hull.beamM) * 100));
	const gy = Math.max(10, Math.min(210, hull.gpsFromBowM / Math.max(1, hull.loaM) * 220));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-lg border border-border bg-background p-2",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-1 text-[9px] tracking-[0.12em] text-muted-foreground uppercase",
				children: "Tap where the phone lives"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
				ref: svgRef,
				viewBox: "0 0 100 220",
				className: "rp-plan mx-auto block h-52 w-full touch-none",
				role: "img",
				"aria-label": "Bird's-eye sailboat. Tap to mark the GPS.",
				"data-testid": "boat-plan",
				onPointerDown: (e) => {
					e.currentTarget.setPointerCapture?.(e.pointerId);
					mark(e.clientX, e.clientY);
				},
				onPointerMove: (e) => {
					if (e.buttons === 0 && e.pressure === 0) return;
					mark(e.clientX, e.clientY);
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("title", { children: "Plan view — bow at the top" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: "50",
						y: "14",
						textAnchor: "middle",
						className: "fill-muted-foreground",
						style: {
							fontSize: 8,
							letterSpacing: 1.4
						},
						children: "BOW"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: "8",
						y: "118",
						textAnchor: "middle",
						className: "fill-muted-foreground",
						style: {
							fontSize: 7,
							letterSpacing: .8
						},
						transform: "rotate(-90 8 118)",
						children: "PORT"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: "92",
						y: "118",
						textAnchor: "middle",
						className: "fill-muted-foreground",
						style: {
							fontSize: 7,
							letterSpacing: .8
						},
						transform: "rotate(90 92 118)",
						children: "STBD"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						className: "rp-plan-hull",
						d: "M50 22 C58 36 66 58 68 92 L70 148 C70 168 64 186 50 204 C36 186 30 168 30 148 L32 92 C34 58 42 36 50 22 Z"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						className: "rp-plan-deck",
						d: "M50 40 C56 50 60 68 61 92 L62 140 C62 154 58 168 50 180 C42 168 38 154 38 140 L39 92 C40 68 44 50 50 40 Z"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						className: "rp-plan-cabin",
						x: "42",
						y: "78",
						width: "16",
						height: "30",
						rx: "3"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						className: "rp-plan-cockpit",
						x: "43",
						y: "114",
						width: "14",
						height: "32",
						rx: "2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						className: "rp-plan-cabin",
						x: "42",
						y: "154",
						width: "16",
						height: "30",
						rx: "3"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						className: "rp-plan-mast",
						cx: "50",
						cy: "72",
						r: "3.2"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						className: "rp-plan-center",
						x1: "50",
						y1: "28",
						x2: "50",
						y2: "198"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						className: "rp-plan-gps",
						cx: gx,
						cy: gy,
						r: "6.5"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						className: "rp-plan-gps-core",
						cx: gx,
						cy: gy,
						r: "2.6"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
						x: "50",
						y: "216",
						textAnchor: "middle",
						className: "fill-muted-foreground",
						style: {
							fontSize: 8,
							letterSpacing: 1.4
						},
						children: "STERN"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-1 text-center text-xs text-muted-foreground",
				children: ["Alarm ", gpsStationLabel(hull)]
			})
		]
	});
}
function BoatPanel() {
	const hull = useHelm((s) => s.hull);
	const setHull = useHelm((s) => s.setHull);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Sheet, {
		id: "boat",
		title: "Boat",
		kicker: "Hull and GPS",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-2 text-xs text-pretty text-muted-foreground",
				children: "Chain is from the bow roller. If the phone sits in the aft cabin, mark it or the hook and alarm sit 10–15 m off."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-2 grid grid-cols-2 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepField, {
						label: "Length m",
						value: hull.loaM,
						step: .5,
						onChange: (n) => setHull({ loaM: n })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepField, {
						label: "Draft m",
						value: hull.draftM,
						step: .1,
						onChange: (n) => setHull({ draftM: n })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepField, {
						label: "Beam m",
						value: hull.beamM,
						step: .1,
						onChange: (n) => setHull({ beamM: n })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StepField, {
						label: "Bow roller m",
						value: hull.bowM,
						step: .1,
						onChange: (n) => setHull({ bowM: n })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoatPlan, {})
		]
	});
}
function HelmApp() {
	useGpsWatch();
	useDemoCruise();
	useAnchorWatch();
	useWakeLock();
	useMarkMade();
	(0, import_react.useEffect)(() => {
		listPacks().then((p) => useHelm.getState().setOfflinePacks(p));
	}, []);
	(0, import_react.useEffect)(() => {
		const params = new URLSearchParams(window.location.search);
		const id = Number(params.get("passage"));
		if (!Number.isFinite(id) || id <= 0) return;
		getPublicPassage({ data: { id } }).then((p) => {
			if (p) useHelm.getState().setActivePassage(p);
		});
	}, []);
	const look = useHelm((s) => s.look);
	const sunPunch = useHelm((s) => s.sunPunch);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `relative h-dvh w-full overflow-hidden bg-background text-foreground${look === "sunlight" ? " rp-sunlight" : look === "night" ? " rp-night" : ""}`,
		"data-sun-punch": look === "sunlight" ? String(sunPunch) : void 0,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapView, {}, "sat-v14"),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TopHud, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NextMarkHud, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MobHud, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SteerOverlay, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavRibbon, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AtlasPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PassagesPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AnchorPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BoatPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegendPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LayersPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SavePanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WeatherPanel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WxStrip, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BottomDock, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Disclaimer, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlarmOverlay, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Toaster, {
				theme: "dark",
				position: "bottom-center",
				offset: { bottom: "5.4rem" },
				toastOptions: { className: "!bg-card !text-foreground !border !border-border !font-sans" }
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HelmApp, {});
}
//#endregion
export { Home as component };
