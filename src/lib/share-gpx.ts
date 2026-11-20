import { gpxFileName, toGpx } from "@/lib/gpx";
import { isNativeApp } from "@/lib/native";
import type { Waypoint } from "@/lib/passages";

/** Phone: write the GPX to the cache and open the share sheet. Browser: download it. */
export async function shareGpx(name: string, points: Waypoint[]): Promise<void> {
  const xml = toGpx(name, points);
  const file = gpxFileName(name);
  if (isNativeApp()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const written = await Filesystem.writeFile({
      path: file,
      data: xml,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: name, files: [written.uri], dialogTitle: "Export track" });
    return;
  }
  const url = URL.createObjectURL(new Blob([xml], { type: "application/gpx+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
