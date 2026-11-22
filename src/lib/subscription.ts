/**
 * Anchor Mate Pro: a free trial that converts to an annual subscription.
 *
 * Billing runs through the App Store and Google Play (both stores require their
 * own billing for digital subscriptions). RevenueCat wraps both stores behind
 * one API and tracks the "pro" entitlement, so the app needs no server.
 *
 * The free trial is configured in the stores as an introductory offer on the
 * annual product, not in code; this module only reads and displays it.
 *
 * Build-time settings (see .env.example):
 *   VITE_REVENUECAT_IOS_KEY      public SDK key for the App Store app
 *   VITE_REVENUECAT_ANDROID_KEY  public SDK key for the Google Play app
 *   VITE_RC_ENTITLEMENT          entitlement id, default "pro"
 *   VITE_PAYWALL_PREVIEW=1       show the paywall in a browser with sample prices
 */
import { create } from "zustand";
import { Capacitor } from "@capacitor/core";
import type {
  CustomerInfo,
  PurchasesPackage,
  PurchasesStoreProduct,
} from "@revenuecat/purchases-capacitor";

export const ENTITLEMENT: string = import.meta.env?.VITE_RC_ENTITLEMENT || "pro";

/**
 * Offshore there is often no signal. If the stores cannot be reached, a
 * subscription seen recently stays unlocked until its expiry plus this grace,
 * so the anchor alarm never locks while a paying skipper is at sea.
 */
export const OFFLINE_GRACE_MS = 7 * 24 * 3_600_000;
const CACHE_KEY = "anchormate.pro.v1";

export type Access = "checking" | "active" | "locked";

export type PlanOffer = {
  /** e.g. "A$49.99" */
  price: string;
  /** e.g. "year" */
  period: string;
  /** e.g. "7-day free trial", or null if the store has no trial on this product */
  trial: string | null;
  /** RevenueCat package to purchase; null in browser preview */
  pkg: PurchasesPackage | null;
};

type Cached = { active: boolean; expiresAt: number | null; checkedAt: number };

/* ---------- pure helpers (unit tested) ---------- */

const UNIT_WORD: Record<string, string> = { D: "day", W: "week", M: "month", Y: "year" };

/** ISO-8601 period ("P7D", "P1Y", "P2W") to words: { n: 7, unit: "day" }. */
export function parsePeriod(iso: string | null | undefined): { n: number; unit: string } | null {
  const m = /^P(\d+)([DWMY])$/.exec(iso ?? "");
  if (!m) return null;
  return { n: Number(m[1]), unit: UNIT_WORD[m[2]!]! };
}

/** "7-day free trial", "1-month free trial", or null. */
export function trialLabel(iso: string | null | undefined): string | null {
  const p = parsePeriod(iso);
  if (!p) return null;
  // Apple reports a 1-week trial as P1W, some stores as P7D. Show what the store says.
  return `${p.n}-${p.unit} free trial`;
}

/** Free trial length of a store product, from either store's representation. */
export function freeTrialPeriod(product: PurchasesStoreProduct): string | null {
  // Google Play: the default offer's free phase.
  const free = product.defaultOption?.freePhase;
  if (free?.billingPeriod?.iso8601) return free.billingPeriod.iso8601;
  // App Store: an introductory offer priced at zero.
  const intro = product.introPrice;
  if (intro && intro.price === 0 && intro.periodNumberOfUnits > 0) {
    const unit = intro.periodUnit.charAt(0).toUpperCase();
    return `P${intro.periodNumberOfUnits * intro.cycles}${unit}`;
  }
  return null;
}

/** Decide access from live entitlement info, falling back to the offline cache. */
export function decideAccess(
  live: { active: boolean } | null,
  cached: Cached | null,
  now: number,
): "active" | "locked" {
  if (live) return live.active ? "active" : "locked";
  if (!cached?.active) return "locked";
  const until = (cached.expiresAt ?? cached.checkedAt) + OFFLINE_GRACE_MS;
  return now < until ? "active" : "locked";
}

/* ---------- store ---------- */

type SubState = {
  access: Access;
  offer: PlanOffer | null;
  busy: boolean;
  error: string | null;
  managementUrl: string | null;
  expiresAt: number | null;
  willRenew: boolean;
  inTrial: boolean;
};

export const useSubscription = create<SubState>(() => ({
  access: "checking",
  offer: null,
  busy: false,
  error: null,
  managementUrl: null,
  expiresAt: null,
  willRenew: false,
  inTrial: false,
}));

function readCache(): Cached | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

function writeCache(c: Cached) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* storage blocked */
  }
}

function applyInfo(info: CustomerInfo) {
  const ent = info.entitlements.active[ENTITLEMENT];
  const active = Boolean(ent?.isActive);
  const expiresAt = ent?.expirationDateMillis ?? null;
  writeCache({ active, expiresAt, checkedAt: Date.now() });
  useSubscription.setState({
    access: active ? "active" : "locked",
    managementUrl: info.managementURL,
    expiresAt,
    willRenew: Boolean(ent?.willRenew),
    inTrial: ent?.periodType === "TRIAL",
  });
}

/**
 * Free app: every feature for everyone, no paywall, trial or purchases (the owner's choice).
 * Build with VITE_PAID_APP=1 to bring back the annual subscription; the RevenueCat code is kept.
 */
export function isFreeApp(): boolean {
  return import.meta.env?.VITE_PAID_APP !== "1";
}

export function isPreview(): boolean {
  return import.meta.env?.VITE_PAYWALL_PREVIEW === "1";
}

function platformKey(): string | undefined {
  const p = Capacitor.getPlatform();
  if (p === "ios") return import.meta.env?.VITE_REVENUECAT_IOS_KEY;
  if (p === "android") return import.meta.env?.VITE_REVENUECAT_ANDROID_KEY;
  return undefined;
}

async function purchases() {
  return (await import("@revenuecat/purchases-capacitor")).Purchases;
}

function toOffer(pkg: PurchasesPackage): PlanOffer {
  const period = parsePeriod(pkg.product.subscriptionPeriod)?.unit ?? "year";
  return {
    price: pkg.product.priceString,
    period,
    trial: trialLabel(freeTrialPeriod(pkg.product)),
    pkg,
  };
}

let started = false;

/** Call once at app start. Safe to call again. */
export async function initSubscription(): Promise<void> {
  if (started) return;
  started = true;

  if (isPreview()) {
    useSubscription.setState({
      access: "locked",
      offer: { price: "A$49.99", period: "year", trial: "7-day free trial", pkg: null },
    });
    return;
  }

  // A browser (development) has no store: the app stays open.
  if (!Capacitor.isNativePlatform()) {
    useSubscription.setState({ access: "active" });
    return;
  }

  const apiKey = platformKey();
  if (!apiKey) {
    useSubscription.setState({
      access: "locked",
      error: "Subscriptions are not set up in this build (missing RevenueCat key).",
    });
    return;
  }

  try {
    const Purchases = await purchases();
    await Purchases.configure({ apiKey });
    await Purchases.addCustomerInfoUpdateListener(applyInfo);
    const { customerInfo } = await Purchases.getCustomerInfo();
    applyInfo(customerInfo);
  } catch {
    // Offline or store unavailable: trust a recent subscription.
    useSubscription.setState({ access: decideAccess(null, readCache(), Date.now()) });
  }
  void loadOffer();
}

export async function loadOffer(): Promise<void> {
  if (isPreview() || !Capacitor.isNativePlatform()) return;
  try {
    const Purchases = await purchases();
    const offerings = await Purchases.getOfferings();
    const cur = offerings.current;
    const pkg = cur?.annual ?? cur?.availablePackages[0] ?? null;
    useSubscription.setState({
      offer: pkg ? toOffer(pkg) : null,
      error: pkg ? null : "No subscription is available right now. Try again later.",
    });
  } catch {
    useSubscription.setState({
      error: "Can't reach the store. Check your connection and try again.",
    });
  }
}

function isCancelled(e: unknown): boolean {
  const err = e as { code?: string; userCancelled?: boolean | null };
  return err?.userCancelled === true || err?.code === "1";
}

export async function buy(): Promise<void> {
  const { offer } = useSubscription.getState();
  if (isPreview()) {
    useSubscription.setState({
      error: "Preview only. In the phone app this opens the store's purchase sheet.",
    });
    return;
  }
  if (!offer?.pkg) return;
  useSubscription.setState({ busy: true, error: null });
  try {
    const Purchases = await purchases();
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: offer.pkg });
    applyInfo(customerInfo);
  } catch (e) {
    if (!isCancelled(e)) {
      useSubscription.setState({ error: "The purchase didn't go through. You were not charged." });
    }
  } finally {
    useSubscription.setState({ busy: false });
  }
}

export async function restore(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  useSubscription.setState({ busy: true, error: null });
  try {
    const Purchases = await purchases();
    const { customerInfo } = await Purchases.restorePurchases();
    applyInfo(customerInfo);
    if (!customerInfo.entitlements.active[ENTITLEMENT]) {
      useSubscription.setState({ error: "No active subscription was found for this account." });
    }
  } catch {
    useSubscription.setState({ error: "Couldn't restore purchases. Check your connection." });
  } finally {
    useSubscription.setState({ busy: false });
  }
}

/** Store page where the user cancels or changes their subscription. */
export function manageUrl(): string {
  const url = useSubscription.getState().managementUrl;
  if (url) return url;
  return Capacitor.getPlatform() === "ios"
    ? "https://apps.apple.com/account/subscriptions"
    : "https://play.google.com/store/account/subscriptions";
}
