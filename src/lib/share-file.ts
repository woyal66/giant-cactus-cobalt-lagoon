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

/**
 * Phone: share sheet with the text (for messages) and the file attached. Browser: share
 * the text where supported, otherwise download the file.
 */
export async function shareTextAndFile(opts: {
  fileName: string;
  file: string;
  mime: string;
  text: string;
  title: string;
}): Promise<void> {
  if (isNativeApp()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const written = await Filesystem.writeFile({
      path: opts.fileName,
      data: opts.file,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: opts.title, text: opts.text, files: [written.uri], dialogTitle: opts.title });
    return;
  }
  await shareTextFile({ fileName: opts.fileName, text: opts.file, mime: opts.mime, title: opts.title });
}
