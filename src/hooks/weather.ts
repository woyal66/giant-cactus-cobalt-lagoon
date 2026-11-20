import { useQuery } from "@tanstack/react-query";
import { getReef } from "@/lib/reefs";
import { fetchWeather, wxLocKey } from "@/lib/weather";
import { useHelm } from "@/store/helm";

export function useHelmLocation() {
  return useHelm((s) => {
    if (s.anchor) return s.anchor;
    if (s.followBoat && s.boat) return s.boat;
    if (s.flyTo) return s.flyTo;
    return s.boat ?? s.lastFix ?? getReef(s.reefId);
  });
}

export function useSpotWx(lat: number | null, lng: number | null) {
  const open = useHelm((s) => s.panel === "weather");
  const key = lat != null && lng != null ? wxLocKey(lat, lng) : "";
  return useQuery({
    queryKey: ["wx", key, "spot"],
    queryFn: () => fetchWeather(lat!, lng!, { compare: true }),
    enabled: open && lat != null && lng != null,
    staleTime: 20 * 60 * 1000,
    retry: 1,
  });
}

export function useWx() {
  const loc = useHelmLocation();
  const open = useHelm((s) => s.panel === "weather");
  const key = loc ? wxLocKey(loc.lat, loc.lng) : "";
  return useQuery({
    queryKey: ["wx", key, open ? "full" : "now"],
    queryFn: () => fetchWeather(loc!.lat, loc!.lng, { compare: open }),
    enabled: Boolean(loc),
    staleTime: 20 * 60 * 1000,
    retry: 1,
    placeholderData: (prev) => prev,
  });
}
