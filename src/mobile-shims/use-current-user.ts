/** Phone build of `@/lib/auth/use-current-user`: no accounts in the store app. */
export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
};

export type CurrentUserState = { user: AppUser | null; isPending: boolean };

const SIGNED_OUT: CurrentUserState = { user: null, isPending: false };

export function useCurrentUserState(): CurrentUserState {
  return SIGNED_OUT;
}

export function useCurrentUser(): AppUser | null {
  return null;
}
