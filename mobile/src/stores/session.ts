import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { CurrentUser } from '@/api/types';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

type Status = 'loading' | 'signedOut' | 'signedIn';

interface SessionState {
  status: Status;
  user: CurrentUser | null;
  tokens: Tokens | null;
  hydrate: () => Promise<void>;
  setSession: (user: CurrentUser, tokens: Tokens) => Promise<void>;
  setTokens: (tokens: Tokens) => Promise<void>;
  clear: () => Promise<void>;
}

// Each value is stored under its own key: Android's secure store is limited to ~2 KB per value.
const KEYS = {
  accessToken: 'rentals.accessToken',
  refreshToken: 'rentals.refreshToken',
  expiresAt: 'rentals.expiresAt',
  user: 'rentals.user',
} as const;

async function writeTokens(tokens: Tokens) {
  await Promise.all([
    SecureStore.setItemAsync(KEYS.accessToken, tokens.accessToken),
    SecureStore.setItemAsync(KEYS.refreshToken, tokens.refreshToken),
    SecureStore.setItemAsync(KEYS.expiresAt, String(tokens.expiresAt)),
  ]);
}

/**
 * The auth session. Tokens live in the Keychain / Keystore via expo-secure-store and are mirrored here
 * for synchronous access. The session is restored from the device on start, without a network call,
 * so a signed-in user stays signed in while offline.
 */
export const useSessionStore = create<SessionState>()((set) => ({
  status: 'loading',
  user: null,
  tokens: null,

  hydrate: async () => {
    try {
      const [accessToken, refreshToken, expiresAt, user] = await Promise.all([
        SecureStore.getItemAsync(KEYS.accessToken),
        SecureStore.getItemAsync(KEYS.refreshToken),
        SecureStore.getItemAsync(KEYS.expiresAt),
        SecureStore.getItemAsync(KEYS.user),
      ]);
      if (accessToken && refreshToken && expiresAt && user) {
        set({
          status: 'signedIn',
          user: JSON.parse(user) as CurrentUser,
          tokens: { accessToken, refreshToken, expiresAt: Number(expiresAt) },
        });
        return;
      }
    } catch {
      // Unreadable secure storage is treated as signed out.
    }
    set({ status: 'signedOut', user: null, tokens: null });
  },

  setSession: async (user, tokens) => {
    await Promise.all([writeTokens(tokens), SecureStore.setItemAsync(KEYS.user, JSON.stringify(user))]);
    set({ status: 'signedIn', user, tokens });
  },

  setTokens: async (tokens) => {
    await writeTokens(tokens);
    set({ tokens });
  },

  clear: async () => {
    await Promise.all(Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key)));
    set({ status: 'signedOut', user: null, tokens: null });
  },
}));

export const useCurrentUser = () => useSessionStore((s) => s.user);

export const useIsManager = () => useSessionStore((s) => s.user?.role === 'PropertyManager');
