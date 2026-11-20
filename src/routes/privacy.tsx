import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({ component: Privacy });

export function Privacy() {
  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
      <div className="mx-auto max-w-lg">
        <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
          Anchor Mate
        </p>
        <h1 className="font-display mt-1 text-4xl font-semibold tracking-tight">Privacy</h1>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-pretty text-muted-foreground">
          <p>
            Anchor Mate reads your phone’s location to show the boat, follow a track, and
            warn if the boat leaves the anchor swing. That fix stays on this phone. It is
            not sold and it is not sent to an Anchor Mate account.
          </p>
          <p>
            Wind and tide are requested from Open-Meteo and the Bureau of Meteorology for
            the place you are looking at. Satellite pictures come from the map providers
            named in the chart menu.
          </p>
          <p>
            Tracks and boat settings are saved on this phone. Closing the app stops the
            anchor check. The watch does not keep running in the background after the app
            is closed.
          </p>
          <p>
            This is a lookout aid, not an official chart. You remain responsible for the
            navigation.
          </p>
        </div>
        <Link
          to="/"
          className="mt-6 inline-block text-sm text-foreground underline-offset-4 hover:underline"
        >
          Back to the helm
        </Link>
      </div>
    </main>
  );
}
