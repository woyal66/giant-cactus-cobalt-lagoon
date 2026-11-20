import { Link } from "@tanstack/react-router";
import { isFreeApp } from "@/lib/subscription";

/**
 * In-app Terms of Use. Keep in sync with docs/terms.html, the hosted copy that
 * the App Store and Google Play listings link to.
 * NOTE: a template, not legal advice. Have it reviewed before release.
 */
export function Terms() {
  return (
    <main className="h-dvh overflow-y-auto bg-background px-5 py-8 text-foreground">
      <div className="mx-auto max-w-lg">
        <p className="text-t12 text-muted-foreground">Anchor Mate</p>
        <h1 className="font-display mt-1 text-4xl font-semibold tracking-tight">Terms of Use</h1>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-pretty text-muted-foreground">
          <h2 className="font-display pt-2 text-base font-semibold text-foreground">
            Navigation aid only
          </h2>
          <p>
            Anchor Mate is a lookout aid. It is not an official nautical chart and must not be
            relied on as the sole means of navigation or of keeping an anchor watch. GPS, phone
            batteries, mobile signal, map imagery, tide and weather data can be wrong, late or
            unavailable. The skipper remains responsible for the safety of the vessel and crew.
          </p>

          {isFreeApp() ? (
            <>
              <h2 className="font-display pt-2 text-base font-semibold text-foreground">Price</h2>
              <p>Anchor Mate is free. There are no purchases, subscriptions or ads in the app.</p>
            </>
          ) : (
            <>
              <h2 className="font-display pt-2 text-base font-semibold text-foreground">
                Subscription and free trial
              </h2>
              <p>
                Anchor Mate Pro is an auto-renewing annual subscription. New subscribers may be
                offered a free trial. If you do not cancel at least 24 hours before the trial ends,
                the annual price shown at purchase is charged to your App Store or Google Play
                account and the subscription renews each year until cancelled.
              </p>
              <p>
                You can cancel or manage the subscription at any time in your App Store or Google
                Play account settings. Cancelling stops the next renewal; access continues until the
                end of the period you have paid for. Refunds are handled by Apple or Google under
                their policies.
              </p>
            </>
          )}

          <h2 className="font-display pt-2 text-base font-semibold text-foreground">Licence</h2>
          <p>
            {isFreeApp()
              ? "You may use Anchor Mate for personal, non-commercial use."
              : "While your subscription or trial is active you may use Anchor Mate on devices signed in to your store account, for personal, non-commercial use."}{" "}
            Purchases through the App Store are also subject to Apple’s Licensed Application End
            User License Agreement.
          </p>

          <h2 className="font-display pt-2 text-base font-semibold text-foreground">
            Limitation of liability
          </h2>
          <p>
            To the extent permitted by law, Anchor Mate is provided “as is” and we are not liable
            for loss or damage arising from its use, including grounding, collision, dragging anchor
            or injury. Nothing in these terms excludes rights you have under the Australian Consumer
            Law that cannot be excluded.
          </p>
        </div>
        <Link
          to="/"
          className="mt-6 inline-block text-sm text-foreground underline-offset-4 hover:underline"
        >
          Back
        </Link>
      </div>
    </main>
  );
}
