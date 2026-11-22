/**
 * Phone build of `@/lib/auth/gates`. The store app has no accounts (purchases are
 * tied to the App Store / Google Play account), so sign-in UI renders nothing and
 * the Better Auth client stays out of the phone bundle.
 */
import type { ReactNode } from "react";

export const SIGN_IN_PATH = "/login";

export function SignedIn(_props: { children: ReactNode }) {
  return null;
}

export function SignedOut(_props: { children: ReactNode }) {
  return null;
}

export function RedirectToSignIn(_props: { to?: string }) {
  return null;
}

export function SignInGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function SignInButtons() {
  return null;
}

export function UserButton() {
  return null;
}
