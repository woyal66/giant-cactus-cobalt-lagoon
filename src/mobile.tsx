import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { HelmApp } from "@/components/helm/helm-app";
import { Privacy } from "@/routes/privacy";
import { Terms } from "@/components/legal/terms";
import { SubscriptionGate } from "@/components/subscription";
import "./styles.css";

function LoginNote() {
  return (
    <main className="min-h-dvh bg-background px-5 py-8 text-foreground">
      <p className="text-[10px] tracking-[0.18em] text-muted-foreground uppercase">Anchor Mate</p>
      <h1 className="font-display mt-1 text-4xl font-semibold">On this phone</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        Tracks and the anchor watch stay on this phone. Cloud sign-in is not part of the store app.
      </p>
      <button
        type="button"
        className="mt-6 text-sm underline"
        onClick={() => {
          window.history.back();
        }}
      >
        Back
      </button>
    </main>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <div className="h-dvh">
      <Outlet />
    </div>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => (
    <SubscriptionGate>
      <HelmApp />
    </SubscriptionGate>
  ),
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/terms",
  component: Terms,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/privacy",
  component: Privacy,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginNote,
});

const routeTree = rootRoute.addChildren([indexRoute, privacyRoute, termsRoute, loginRoute]);
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});
const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

function NativeChrome() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: Style.Dark });
    void StatusBar.setBackgroundColor({ color: "#071318" });
    const handle = CapApp.addListener("backButton", () => {
      const path = router.state.location.pathname;
      if (path !== "/") router.history.back();
      else void CapApp.exitApp();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);
  return null;
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <QueryClientProvider client={queryClient}>
      <NativeChrome />
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
