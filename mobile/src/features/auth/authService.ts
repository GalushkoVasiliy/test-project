import { setSessionExpiredHandler, toTokens } from '@/api/client';
import { authApi } from '@/api/endpoints';
import type { AccessTokenResponse, UserRole } from '@/api/types';
import { clearUserData } from '@/query/queryClient';
import { useFiltersStore } from '@/stores/filters';
import { useSessionStore } from '@/stores/session';
import { useSyncStore } from '@/stores/sync';
import { toast } from '@/stores/toast';

export async function signIn(email: string, password: string) {
  await startSession(await authApi.login(email.trim(), password));
}

export async function signUp(input: { email: string; password: string; fullName: string; role: UserRole }) {
  await startSession(await authApi.register({ ...input, email: input.email.trim(), fullName: input.fullName.trim() }));
}

/** Signs out locally. Cached data and unsynced changes belong to this user, so they are discarded too. */
export async function signOut() {
  await clearUserData();
  useSyncStore.getState().reset();
  useFiltersStore.getState().reset();
  await useSessionStore.getState().clear();
}

async function startSession(response: AccessTokenResponse) {
  const tokens = toTokens(response);
  const user = await authApi.me(tokens.accessToken);

  // Another account may have used this device before: never show its cached data.
  await clearUserData();
  useSyncStore.getState().reset();
  await useSessionStore.getState().setSession(user, tokens);
}

setSessionExpiredHandler(async () => {
  await signOut();
  toast.info('Session expired', 'Please sign in again.');
});
