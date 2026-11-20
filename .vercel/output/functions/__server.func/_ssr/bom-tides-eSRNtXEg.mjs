import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { i as parseBomPrint } from "./tides-VTljZa2R.mjs";
import { gn as object, yn as string } from "../_libs/@better-auth/core+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/bom-tides-eSRNtXEg.js
var AAC = /^[A-Z]{2,4}_TP[0-9]{3,4}$/;
var TZ = /^[A-Za-z]+\/[A-Za-z_]+$/;
function regionOfAac(aac) {
	const p = aac.split("_")[0] ?? "QLD";
	return p === "INT" ? "OTHER" : p;
}
function bomPrintUrl(aac, tz) {
	const region = regionOfAac(aac);
	return `https://www.bom.gov.au/australia/tides/print.php?aac=${encodeURIComponent(aac)}&type=tide&region=${encodeURIComponent(region)}&tz=${encodeURIComponent(tz)}&days=7`;
}
var fetchBomPrint_createServerFn_handler = createServerRpc({
	id: "2e16fc0afdf81763e19ecc7185cbdf72f38d08d23f03b8c5f1fa55e2c29b9961",
	name: "fetchBomPrint",
	filename: "src/lib/bom-tides.ts"
}, (opts) => fetchBomPrint.__executeServer(opts));
var fetchBomPrint = createServerFn({ method: "GET" }).validator(object({
	aac: string().regex(AAC),
	tz: string().regex(TZ)
})).handler(fetchBomPrint_createServerFn_handler, async ({ data }) => {
	const url = bomPrintUrl(data.aac, data.tz);
	try {
		const res = await fetch(url, {
			signal: AbortSignal.timeout(9e3),
			headers: {
				Accept: "text/html",
				"User-Agent": "ReefPilot/1 (yacht nav; BOM tide tables)"
			}
		});
		if (!res.ok) return { turns: [] };
		const html = await res.text();
		return { turns: parseBomPrint(html) };
	} catch {
		return { turns: [] };
	}
});
//#endregion
export { fetchBomPrint_createServerFn_handler };
