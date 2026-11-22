/**
 * Open-Meteo's free API is for non-commercial use only. A paid app needs an API
 * subscription (open-meteo.com/en/pricing), which is served from "customer-"
 * hosts with an `apikey` parameter. Set VITE_OPEN_METEO_KEY at build time and
 * every forecast, marine and tide request switches over automatically.
 */
const KEY: string | undefined = import.meta.env?.VITE_OPEN_METEO_KEY || undefined;

export function openMeteoUrl(url: string): URL {
  const u = new URL(url);
  if (KEY) {
    if (!u.hostname.startsWith("customer-")) u.hostname = `customer-${u.hostname}`;
    u.searchParams.set("apikey", KEY);
  }
  return u;
}

export function hasOpenMeteoKey(): boolean {
  return Boolean(KEY);
}
