import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isNativeApp } from "@/lib/native";
import { buildMessage, newTopic, ntfyAppUrl, publish, subscribeUrl } from "@/lib/remote-watch";
import { useHelm } from "@/store/helm";

async function shareLink(url: string) {
  const text = `Anchor Mate remote watch: install the free ntfy app, then open ${url} and tap Subscribe.`;
  try {
    if (isNativeApp()) {
      const { Share } = await import("@capacitor/share");
      await Share.share({ title: "Anchor Mate remote watch", text, url, dialogTitle: "Send to the second phone" });
      return;
    }
    if (navigator.share) {
      await navigator.share({ title: "Anchor Mate remote watch", text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  } catch (err) {
    if (!/cancel|abort/i.test(String(err))) toast.error("Couldn't share the link");
  }
}

/** Pair a second phone so it gets the anchor alarms too. */
export function RemoteWatchCard() {
  const pair = useHelm((s) => s.remoteWatch);
  const setPair = useHelm((s) => s.setRemoteWatch);
  const [name, setName] = useState(pair?.boatName ?? "");
  const [qr, setQr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const url = pair ? subscribeUrl(pair.topic) : null;

  useEffect(() => {
    if (!url) {
      setQr(null);
      return;
    }
    let live = true;
    void QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#071318", light: "#ffffff" } })
      .then((d) => {
        if (live) setQr(d);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [url]);

  if (!pair) {
    return (
      <div className="mb-2 rounded-lg border border-border bg-background px-3 py-2">
        <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Remote watch</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          Send the anchor alarms to a second phone too: your partner&apos;s, or yours in the cabin.
        </p>
        <label className="mt-2 grid gap-1">
          <span className="text-[10px] tracking-[0.12em] text-muted-foreground uppercase">Boat name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Saltwater" className="h-10" maxLength={40} />
        </label>
        <Button className="mt-2 w-full" onClick={() => setPair({ topic: newTopic(), boatName: name.trim() })}>
          Set up remote watch
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-2 rounded-lg border border-primary/40 bg-background px-3 py-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] tracking-[0.14em] text-muted-foreground uppercase">Remote watch on</p>
        <span className="text-[11px] text-primary">{pair.boatName || "Your boat"}</span>
      </div>
      <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[12px] leading-snug text-muted-foreground">
        <li>On the second phone, install the free <span className="font-semibold text-foreground">ntfy</span> app.</li>
        <li>Scan this code with its camera, or send the link, then tap Subscribe.</li>
        <li>Tap Send test alert below and check it arrives with sound.</li>
      </ol>
      <div className="mt-2 flex items-center gap-3">
        {qr ? (
          <img src={qr} alt="QR code for the remote watch channel" className="size-28 shrink-0 rounded-md" />
        ) : (
          <div className="size-28 shrink-0 rounded-md bg-muted" />
        )}
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Button variant="outline" size="sm" onClick={() => void shareLink(url!)}>
            Send link
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={sending}
            onClick={() => {
              setSending(true);
              void publish(buildMessage(pair.topic, "test", { boatName: pair.boatName }))
                .then((ok) => (ok ? toast.success("Test alert sent") : toast.error("Couldn't reach the alert server. Check signal.")))
                .finally(() => setSending(false));
            }}
          >
            Send test alert
          </Button>
          <a href={ntfyAppUrl(pair.topic)} className="truncate text-center text-[11px] text-muted-foreground underline">
            Open in ntfy on this phone
          </a>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        The second phone needs mobile data or Wi-Fi. In ntfy, keep notification sound on for this channel
        (Android: set it to max priority to ring through Do Not Disturb). Alerts include the boat&apos;s position,
        sent only to this private channel.
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 w-full"
        onClick={() => {
          if (window.confirm("Turn off remote watch? The second phone will stop getting alarms.")) setPair(null);
        }}
      >
        Turn off remote watch
      </Button>
    </div>
  );
}
