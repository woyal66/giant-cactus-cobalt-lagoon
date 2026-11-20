import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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

/** Browser cannot fetch BOM (no CORS). This runs on the server. */
export const fetchBomPrint = createServerFn({ method: "GET" })
  .validator(
    z.object({
      aac: z.string().regex(AAC),
      tz: z.string().regex(TZ),
    }),
  )
  .handler(async ({ data }): Promise<{ turns: TideTurn[] }> => {
    const url = bomPrintUrl(data.aac, data.tz);
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(9000),
        headers: {
          Accept: "text/html",
          "User-Agent": "AnchorMate/1 (yacht nav; BOM tide tables)",
        },
      });
      if (!res.ok) return { turns: [] };
      const html = await res.text();
      return { turns: parseBomPrint(html) };
    } catch {
      return { turns: [] };
    }
  });
