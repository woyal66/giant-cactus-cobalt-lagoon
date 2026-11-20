import { isNativeApp } from "@/lib/native";

/** Phone: write to the cache and open the share sheet. Browser: download. */
export async function shareTextFile(opts: {
  fileName: string;
  text: string;
  mime: string;
  title: string;
}): Promise<void> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const written = await Filesystem.writeFile({
      path: opts.fileName,
      data: opts.text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: opts.title, files: [written.uri], dialogTitle: opts.title });
    return;
  }
  const url = URL.createObjectURL(new Blob([opts.text], { type: opts.mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = opts.fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
