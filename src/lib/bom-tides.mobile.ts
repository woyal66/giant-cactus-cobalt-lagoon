/**
 * Phone build of `bom-tides.ts`. The website fetches BOM tide tables through a
 * server function because browsers are blocked by CORS. The phone app has no
 * server, but CapacitorHttp makes the request natively, where CORS does not apply.
 */
import { CapacitorHttp } from "@capacitor/core";
import { parseBomPrint, type TideTurn } from "./tides.ts";

const AAC = /^[A-Z]{2,4}_TP[0-9]{3,4}$/;
const TZ = /^[A-Za-z]+\/[A-Za-z_]+$/;

export function regionOfAac(aac: string): string {
  const p = aac.split("_")[0] ?? "QLD";
  return p === "INT" ? "OTHER" : p;
}

export function bomPrintUrl(aac: string, tz: string): string {
  const region = regionOfAac(aac);
  return (
    `https://www.bom.gov.au/australia/tides/print.php?aac=${encodeURIComponent(aac)}` +
    `&type=tide&region=${encodeURIComponent(region)}` +
    `&tz=${encodeURIComponent(tz)}&days=7`
  );
}

export async function fetchBomPrint({
  data,
}: {
  data: { aac: string; tz: string };
}): Promise<{ turns: TideTurn[] }> {
  if (!AAC.test(data.aac) || !TZ.test(data.tz)) return { turns: [] };
  try {
    const res = await CapacitorHttp.get({
      url: bomPrintUrl(data.aac, data.tz),
      headers: { Accept: "text/html" },
      responseType: "text",
      connectTimeout: 9000,
      readTimeout: 9000,
    });
    if (res.status < 200 || res.status >= 300 || typeof res.data !== "string") {
      return { turns: [] };
    }
    return { turns: parseBomPrint(res.data) };
  } catch {
    return { turns: [] };
  }
}
