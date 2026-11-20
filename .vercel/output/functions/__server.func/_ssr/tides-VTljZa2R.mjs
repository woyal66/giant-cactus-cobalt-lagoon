//#region node_modules/.nitro/vite/services/ssr/assets/tides-VTljZa2R.js
function stamp(s) {
	if (!s) return NaN;
	if (/Z$|[+-]\d\d:\d\d$/.test(s)) return Date.parse(s);
	return Date.parse(`${s}Z`);
}
function parseTideHours(times, heights, now = Date.now(), maxHours = 192) {
	const hours = [];
	for (let i = 0; i < times.length; i += 1) {
		const at = stamp(times[i] ?? "");
		const m = heights[i];
		if (!Number.isFinite(at) || typeof m !== "number" || !Number.isFinite(m)) continue;
		if (at < now - 3e6) continue;
		hours.push({
			at,
			m: Math.round(m * 100) / 100
		});
		if (hours.length >= maxHours) break;
	}
	return hours;
}
function tideTurns(hours) {
	if (hours.length < 3) return [];
	const out = [];
	for (let i = 1; i < hours.length - 1; i += 1) {
		const a = hours[i - 1];
		const b = hours[i];
		const c = hours[i + 1];
		if (b.m >= a.m && b.m >= c.m && (b.m > a.m || b.m > c.m)) out.push({
			kind: "high",
			at: b.at,
			m: b.m
		});
		else if (b.m <= a.m && b.m <= c.m && (b.m < a.m || b.m < c.m)) out.push({
			kind: "low",
			at: b.at,
			m: b.m
		});
	}
	return out;
}
function windowTide(hours, t0, horizonH) {
	const end = t0 + Math.max(1, horizonH) * 36e5;
	return hours.filter((h) => h.at >= t0 - 12e5 && h.at <= end + 12e5);
}
function tideRange(hours) {
	if (hours.length === 0) return {
		minM: 0,
		maxM: 1
	};
	let minM = hours[0].m;
	let maxM = hours[0].m;
	for (const h of hours) {
		minM = Math.min(minM, h.m);
		maxM = Math.max(maxM, h.m);
	}
	if (maxM - minM < .2) {
		const mid = (minM + maxM) / 2;
		return {
			minM: mid - .1,
			maxM: mid + .1
		};
	}
	return {
		minM,
		maxM
	};
}
/** Lowest predicted MSL minus 10 cm — a stand-in for LAT when no station datum exists. */
function latDatumM(hours) {
	if (hours.length === 0) return 0;
	let min = hours[0].m;
	for (const h of hours) min = Math.min(min, h.m);
	return Math.round((min - .1) * 100) / 100;
}
function toLatM(mslM, datumM) {
	return Math.round((mslM - datumM) * 100) / 100;
}
function nextTurn(turns, kind, now = Date.now()) {
	return turns.find((t) => t.kind === kind && t.at >= now - 12e5) ?? null;
}
/** Height and remaining rise to the next high — from now, not the first sample. */
function tideRiseAt(turns, hours, now = Date.now()) {
	const raw = (turns.length >= 2 ? heightBetweenTurns(turns, now) : null) ?? tideAt(hours, now) ?? hours[0]?.m ?? 0;
	const nowM = Math.round(raw * 100) / 100;
	const high = nextTurn(turns, "high", now);
	return {
		nowM,
		high,
		low: nextTurn(turns, "low", now),
		riseM: high ? Math.max(0, Math.round((high.m - nowM) * 10) / 10) : 0
	};
}
function tideAt(hours, at) {
	if (hours.length === 0) return null;
	const first = hours[0];
	const last = hours[hours.length - 1];
	if (at <= first.at) return first.m;
	if (at >= last.at) return last.m;
	for (let i = 1; i < hours.length; i += 1) {
		const b = hours[i];
		const a = hours[i - 1];
		if (at <= b.at) {
			const t = (at - a.at) / Math.max(1, b.at - a.at);
			return Math.round((a.m + (b.m - a.m) * t) * 100) / 100;
		}
	}
	return last.m;
}
function tideRising(hours, at) {
	const a = tideAt(hours, at);
	const b = tideAt(hours, at + 24e5);
	if (a == null || b == null) return null;
	const d = b - a;
	if (Math.abs(d) < .03) return null;
	return d > 0;
}
function parseTideWatch(json, now = Date.now()) {
	const hours = parseTideHours(json.hourly?.time ?? [], json.hourly?.sea_level_height_msl ?? [], now);
	if (hours.length < 2) return null;
	const nowH = hours[0];
	const day = windowTide(hours, nowH.at, 24);
	const turns = tideTurns(hours);
	let high = nextTurn(turns, "high", now);
	let low = nextTurn(turns, "low", now);
	if (!high) {
		let m = nowH;
		for (const h of day) if (h.m > m.m) m = h;
		high = {
			kind: "high",
			at: m.at,
			m: m.m
		};
	}
	if (!low) {
		let m = nowH;
		for (const h of day) if (h.m < m.m) m = h;
		low = {
			kind: "low",
			at: m.at,
			m: m.m
		};
	}
	return {
		nowM: nowH.m,
		highM: high.m,
		riseM: Math.max(0, Math.round((high.m - nowH.m) * 10) / 10),
		highAt: high.at,
		lowM: low.m,
		lowAt: low.at,
		hours,
		turns,
		origin: {
			kind: "model",
			name: "Open-Meteo marine",
			datum: "LAT estimate"
		}
	};
}
/** Cosine between published high/low — the usual way to sketch a curve from a table. */
function hoursFromTurns(turns, t0, horizonH, stepMin = 20) {
	if (turns.length < 2) return [];
	const sorted = [...turns].sort((a, b) => a.at - b.at);
	const end = t0 + Math.max(1, horizonH) * 36e5;
	const step = stepMin * 6e4;
	const hours = [];
	for (let t = t0; t <= end; t += step) {
		const m = heightBetweenTurns(sorted, t);
		if (m == null) continue;
		hours.push({
			at: t,
			m: Math.round(m * 100) / 100
		});
	}
	return hours;
}
function heightBetweenTurns(turns, at) {
	if (turns.length === 0) return null;
	if (at <= turns[0].at) return turns[0].m;
	const last = turns[turns.length - 1];
	if (at >= last.at) return last.m;
	for (let i = 1; i < turns.length; i += 1) {
		const b = turns[i];
		const a = turns[i - 1];
		if (at <= b.at) {
			const span = Math.max(1, b.at - a.at);
			const u = (at - a.at) / span;
			return a.m + (b.m - a.m) * (1 - Math.cos(Math.PI * u)) / 2;
		}
	}
	return last.m;
}
function parseBomPrint(html) {
	const out = [];
	const re = /<(?:th|td)[^>]*class="instance (high|low)-tide"[^>]*>[\s\S]*?data-time-utc="([^"]+)"[\s\S]*?class="height \1-tide"[^>]*>\s*([0-9]+(?:\.[0-9]+)?)\s*m/gi;
	let m;
	while (m = re.exec(html)) {
		const kind = m[1] === "high" ? "high" : "low";
		const at = Date.parse(m[2]);
		const h = Number(m[3]);
		if (!Number.isFinite(at) || !Number.isFinite(h)) continue;
		out.push({
			kind,
			at,
			m: Math.round(h * 100) / 100
		});
	}
	if (out.length >= 2) return out.sort((a, b) => a.at - b.at);
	const loose = /data-time-utc="([^"]+)"[\s\S]{0,280}class="height (high|low)-tide"[^>]*>\s*([0-9]+(?:\.[0-9]+)?)\s*m/gi;
	while (m = loose.exec(html)) {
		const at = Date.parse(m[1]);
		const kind = m[2] === "high" ? "high" : "low";
		const h = Number(m[3]);
		if (!Number.isFinite(at) || !Number.isFinite(h)) continue;
		out.push({
			kind,
			at,
			m: Math.round(h * 100) / 100
		});
	}
	out.sort((a, b) => a.at - b.at);
	return out.filter((t, i, a) => i === 0 || t.at !== a[i - 1].at);
}
async function fetchTideRise(lat, lng) {
	const { fetchBomStationTide } = await import("./tide-station-CdgGseon.mjs").then((n) => n.a);
	try {
		const station = await fetchBomStationTide(lat, lng);
		if (station) {
			const now = Date.now();
			const r = tideRiseAt(station.turns, station.hours, now);
			if (r.high) return {
				nowM: r.nowM,
				highM: r.high.m,
				riseM: r.riseM,
				highAt: r.high.at,
				lowM: r.low?.m ?? r.nowM,
				lowAt: r.low?.at ?? r.high.at,
				hours: station.hours,
				turns: station.turns,
				origin: station.origin
			};
		}
	} catch {}
	const url = new URL("https://marine-api.open-meteo.com/v1/marine");
	url.searchParams.set("latitude", lat.toFixed(4));
	url.searchParams.set("longitude", lng.toFixed(4));
	url.searchParams.set("hourly", "sea_level_height_msl");
	url.searchParams.set("forecast_days", "3");
	url.searchParams.set("timezone", "GMT");
	const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8e3) });
	if (!res.ok) throw new Error("tide fetch failed");
	const watch = parseTideWatch(await res.json());
	if (!watch) throw new Error("no tide samples");
	return watch;
}
//#endregion
export { parseTideHours as a, tideRiseAt as c, toLatM as d, windowTide as f, parseBomPrint as i, tideRising as l, hoursFromTurns as n, tideAt as o, latDatumM as r, tideRange as s, fetchTideRise as t, tideTurns as u };
