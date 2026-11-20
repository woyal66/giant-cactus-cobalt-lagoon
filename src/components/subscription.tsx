import { useEffect, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Anchor, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buy,
  initSubscription,
  isPreview,
  loadOffer,
  manageUrl,
  restore,
  useSubscription,
} from "@/lib/subscription";

const FEATURES = [
  "Anchor drag alarm that keeps watch with the screen locked",
  "Satellite charts with OpenSeaMap seamarks and depth contours",
  "Offline chart packs for when there's no signal",
  "BOM tides, wind and swell for where you are",
  "Track recording, steering cues and man-overboard mark",
];

/** Shows the app once the subscription (or free trial) is active, else the paywall. */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const access = useSubscription((s) => s.access);
  useEffect(() => {
    void initSubscription();
  }, []);

  if (access === "active") return <>{children}</>;
  if (access === "checking") {
    return (
      <main className="grid h-dvh place-items-center bg-background text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-label="Loading" />
      </main>
    );
  }
  return <Paywall />;
}

export function Paywall() {
  const offer = useSubscription((s) => s.offer);
  const busy = useSubscription((s) => s.busy);
  const error = useSubscription((s) => s.error);

  const cta = offer?.trial ? `Start ${offer.trial}` : "Subscribe";
  const priceLine = offer
    ? offer.trial
      ? `${offer.trial}, then ${offer.price} per ${offer.period}`
      : `${offer.price} per ${offer.period}`
    : null;

  return (
    <main className="h-dvh overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Anchor className="size-7" aria-hidden />
        </div>
        <p className="mt-5 text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Anchor Mate Pro
        </p>
        <h1 className="font-display mt-1 text-4xl leading-tight font-semibold tracking-tight text-balance">
          Sleep while the phone keeps watch
        </h1>

        <ul className="mt-6 space-y-3">
          {FEATURES.map((f) => (
            <li key={f} className="flex gap-3 text-sm leading-snug">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-8">
          {priceLine ? (
            <p className="text-center font-display text-lg font-semibold">{priceLine}</p>
          ) : !error ? (
            <p className="text-center text-sm text-muted-foreground">Loading price…</p>
          ) : null}

          <Button
            size="lg"
            className="mt-3 w-full text-base"
            disabled={(!offer?.pkg && !isPreview()) || busy}
            onClick={() => void buy()}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {cta}
          </Button>

          {error ? (
            <div className="mt-3 text-center text-sm text-destructive" role="alert">
              <p>{error}</p>
              {!offer ? (
                <button type="button" className="mt-1 underline" onClick={() => void loadOffer()}>
                  Try again
                </button>
              ) : null}
            </div>
          ) : null}

          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground text-pretty">
            {offer?.trial
              ? `No charge during the ${offer.trial.replace(" free trial", "")} trial. `
              : ""}
            Payment is charged to your {storeName()} account
            {offer?.trial ? " when the trial ends" : " at confirmation of purchase"}. The
            subscription renews automatically each {offer?.period ?? "year"} unless it is
            cancelled at least 24 hours before the end of the current period. Manage or cancel
            any time in your {storeName()} account settings.
          </p>

          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <button
              type="button"
              className="underline-offset-4 hover:underline"
              disabled={busy}
              onClick={() => void restore()}
            >
              Restore purchases
            </button>
            <span aria-hidden>·</span>
            <Link to="/terms" className="underline-offset-4 hover:underline">
              Terms of Use
            </Link>
            <span aria-hidden>·</span>
            <Link to="/privacy" className="underline-offset-4 hover:underline">
              Privacy
            </Link>
          </div>
          {isPreview() ? (
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              Preview with sample prices. Real prices come from the store.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function storeName(): string {
  if (typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)) {
    return "Apple ID";
  }
  return "Google Play";
}

/** Small row for the View panel: subscription status and how to manage it. */
export function SubscriptionRow() {
  const expiresAt = useSubscription((s) => s.expiresAt);
  const willRenew = useSubscription((s) => s.willRenew);
  const inTrial = useSubscription((s) => s.inTrial);
  const busy = useSubscription((s) => s.busy);

  const date = expiresAt ? new Date(expiresAt).toLocaleDateString() : null;
  const status = inTrial
    ? `Free trial${date ? ` until ${date}` : ""}`
    : date
      ? `${willRenew ? "Renews" : "Ends"} ${date}`
      : "Active";

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="font-display text-sm leading-none font-semibold">Anchor Mate Pro</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{status}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void restore()}>
          Restore
        </Button>
        <Button asChild variant="outline" size="sm">
          <a href={manageUrl()} target="_blank" rel="noreferrer">
            Manage
          </a>
        </Button>
      </div>
    </div>
  );
}
