import { createFileRoute, Link } from "@tanstack/react-router";
import { isFreeApp } from "@/lib/subscription";

export const Route = createFileRoute("/privacy")({ component: Privacy });

export function Privacy() {
  return (
    <main className="h-dvh overflow-y-auto bg-background px-5 py-8 text-foreground">
      <div className="mx-auto max-w-lg">
        <p className="text-t12 text-muted-foreground">
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
            Wind, waves, currents and tides are requested from Open-Meteo and the Bureau of
            Meteorology for the place you are looking at or planning a passage to. Maps come from the
            providers named in the chart menu (satellite photos), OpenFreeMap (the Chart map), AWS
            Terrain Tiles and this app&apos;s own website (seabed depth and tide tables), NOAA (official US charts, if you turn them on) and, if you turn them on, RainViewer and, in US waters, NOAA (rain radar) and NASA GIBS (satellite cloud pictures). These requests
            carry the area being shown, not who you are, and are not used to build a profile.
          </p>
          <p>
            Tracks and boat settings are saved on this phone. While an anchor watch or track is
            running, the phone app keeps reading your location with the screen locked so the
            alarm can sound. It stops when you lift the anchor or end the track. Swiping the app
            closed also stops the watch.
          </p>
          <p>
            If you turn on Remote watch, anchor watch alerts with the boat&apos;s position are sent
            through the ntfy notification service to a private channel that only your paired phones
            know. The service logs the channel name and IP address to limit abuse. Remote watch is off
            unless you set it up, and turning it off stops all sending.
          </p>
          <p>
            If you choose to share a track to the online track library, share an anchorage (its
            position, depth, bottom, shelter and comment) or add a place (its position, kind, name,
            radio channel, phone and note), it is published for other users to find.
            For a track that is its points, name, location label and comment. Your name and contact
            details are not sent. Shared tracks are stored with Supabase, and only the phone that
            shared a track can remove it. Nothing is shared unless you tap Share.
          </p>
          <p>
            AIS is off unless you turn it on. Online AIS sends aisstream.io your own key and an area of
            about 80 km around the boat, so it can send back the ships in it; it does not send your
            boat&apos;s identity. Boat Wi-Fi AIS talks only to the Signal K server on your boat.
            Marine rescue reminders stay on the phone: the app never contacts marine rescue for you.
          </p>
          <p>
            Backups are files you save yourself, for example to iCloud Drive or Google Drive. They
            contain your tracks and settings, not your anchor watch.
          </p>
          {isFreeApp() ? (
            <p>The app is free and has no purchases, so no payment or purchase data is collected.</p>
          ) : (
            <p>
              Subscriptions are paid through the App Store or Google Play. We use RevenueCat to
              check whether your subscription is active. It receives an anonymous app ID and your
              purchase history from the store, not your name, payment card or location.
            </p>
          )}
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
