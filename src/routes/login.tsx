import { createFileRoute, Link } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm">
        <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Anchor Mate
        </p>
        <h1 className="font-display mt-1 text-4xl font-semibold tracking-tight">
          Sign in to share tracks
        </h1>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          Publish cuts and anchorages to the library so the next skipper can
          follow your water.
        </p>
        <div className="mt-6 grid gap-2">
          {authEnabled ? (
            GROK_PROVIDERS.map((p) => (
              <Button
                key={p.providerId}
                type="button"
                variant="helm"
                className="h-12 w-full"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </Button>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sign-in is disabled.</p>
          )}
        </div>
        <p className="mt-6 text-center">
          <Link
            to="/"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Back to the helm
          </Link>
        </p>
      </div>
    </main>
  );
}
