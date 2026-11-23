import { useState } from "react";
import { isNativeApp } from "@/lib/native";
import { useHelm } from "@/store/helm";

const KEY = "anchormate-web-notice";

/**
 * Website only: what the browser version is for, and that the anchor alarm needs the tab open.
 * Dismissible; comes back as one line while an anchor watch is running in the browser.
 */
export function WebNotice() {
  const watching = useHelm((s) => Boolean(s.anchor?.radiusLocked && !s.anchor.demo));
  const panel = useHelm((s) => s.panel);
  const guideDone = useHelm((s) => s.guideDone);
  const [closed, setClosed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  if (isNativeApp() || panel || !guideDone) return null;
  if (watching) {
    return (
      <div className="pointer-events-auto absolute inset-x-2 top-[calc(max(0.4rem,var(--safe-area-inset-top,env(safe-area-inset-top)))+3.4rem)] z-40 mx-auto max-w-md rounded-lg border border-amber-400/60 bg-card/95 px-3 py-2 text-t14 leading-snug shadow-[var(--shadow-border)]">
        <b>Keep this tab open and the screen on.</b> In a browser the anchor alarm stops when the tab is closed,
        hidden or the computer sleeps. Use the phone app at anchor.
      </div>
    );
  }
  if (closed) return null;
  return (
    <div className="pointer-events-auto absolute inset-x-2 top-[calc(max(0.4rem,var(--safe-area-inset-top,env(safe-area-inset-top)))+3.4rem)] z-40 mx-auto max-w-md rounded-lg border border-border bg-card/95 px-3 py-2.5 shadow-[var(--shadow-border)]">
      <p className="text-t15 font-semibold">Anchor Mate on the web</p>
      <p className="mt-0.5 text-t14 leading-snug text-muted-foreground">
        Plan passages, check weather, tides, depths and reef hazards, and save offline areas. For the anchor alarm with
        the screen locked, use the phone app. Move plans to the phone with Tracks → GPX or a backup file.
      </p>
      <button
        type="button"
        className="mt-1.5 h-10 rounded-md border border-border px-3 text-t14 font-semibold"
        onClick={() => {
          setClosed(true);
          try {
            localStorage.setItem(KEY, "1");
          } catch {
            /* private mode */
          }
        }}
      >
        Got it
      </button>
    </div>
  );
}
