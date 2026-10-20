import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, MutationCache, onlineManager, QueryClient, type Mutation } from '@tanstack/react-query';
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { AppState } from 'react-native';

import { API_URL } from '@/api/config';
import { ApiError, errorMessage, NetworkError } from '@/api/errors';
import { useSyncStore } from '@/stores/sync';
import { toast } from '@/stores/toast';

import { describeMutation, registerMutationDefaults } from './mutations';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** The screen shows this mutation's errors itself (e.g. as field errors), so skip the toast. */
      inlineErrors?: boolean;
    };
  }
}

const DAY = 24 * 60 * 60 * 1000;
const CACHE_MAX_AGE = 7 * DAY;
/** Bump when the shape of cached data changes, so old caches are discarded. */
const CACHE_BUSTER = 'v1';

/**
 * One client (and its bookkeeping) for the lifetime of the JS runtime. In development, Fast Refresh
 * re-runs this module when a dependency changes; without this a second client would be created and
 * screens and mutations could end up talking to different caches.
 */
const runtime = globalThis as typeof globalThis & {
  __rentalsQueryClient?: QueryClient;
  __rentalsQueuedMutationIds?: Set<number>;
};

/** Mutations that waited in the offline queue. Their failures surface as "rejected changes". */
const queuedMutationIds = (runtime.__rentalsQueuedMutationIds ??= new Set<number>());

export const queryClient = (runtime.__rentalsQueryClient ??= createQueryClient());

// Safe to repeat: re-registering replaces the defaults (picks up edits during development).
registerMutationDefaults(queryClient);

function createQueryClient(): QueryClient {
  const client = new QueryClient({
    mutationCache: new MutationCache({ onError: reportMutationError }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Must be at least the persister's maxAge, or cached data is dropped before it can be restored.
        gcTime: CACHE_MAX_AGE,
        retry: (failureCount, error) =>
          error instanceof ApiError ? error.status >= 500 && failureCount < 2 : failureCount < 2,
      },
      mutations: {
        // Creates are idempotent and transitions tolerate replays, so retrying after a lost response is safe.
        retry: (failureCount, error) => {
          if (error instanceof NetworkError) return failureCount < 5;
          if (error instanceof ApiError && error.status >= 500) return failureCount < 2;
          return false;
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      },
    },
  });

  client.getMutationCache().subscribe((event) => {
    if (event.type === 'added' && event.mutation.state.isPaused) {
      queuedMutationIds.add(event.mutation.mutationId); // restored from storage
    } else if (event.type === 'updated' && event.action.type === 'pause') {
      queuedMutationIds.add(event.mutation.mutationId); // went offline before or during the request
    } else if (event.type === 'removed') {
      queuedMutationIds.delete(event.mutation.mutationId);
    }
  });

  return client;
}

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'rentals.query-cache',
  throttleTime: 1000,
  // A mutation that was still running when the app was closed is stored as paused, so that it is
  // resumed (replayed) on the next start instead of being stuck.
  serialize: (client) =>
    JSON.stringify({
      ...client,
      clientState: {
        ...client.clientState,
        mutations: client.clientState.mutations.map((m) =>
          m.state.status === 'pending' ? { ...m, state: { ...m.state, isPaused: true } } : m,
        ),
      },
    }),
});

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister,
  maxAge: CACHE_MAX_AGE,
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === 'success',
    shouldDehydrateMutation: (mutation) => mutation.state.status === 'pending',
  },
};

/** Once the cache is restored, replay the queued changes and refresh whatever is on screen. */
export async function onCacheRestored() {
  await queryClient.resumePausedMutations();
  await queryClient.invalidateQueries();
}

/** Forget everything cached for the signed-in user, including changes that have not synced yet. */
export async function clearUserData() {
  await queryClient.cancelQueries();
  queryClient.getMutationCache().clear();
  queryClient.clear();
  await persister.removeClient();
  queuedMutationIds.clear();
}

// Connectivity: NetInfo drives TanStack Query's onlineManager. While offline, queries are served from
// the cache and mutations are paused; going back online resumes the paused mutations automatically.
// "Online" means the API is reachable, not the internet in general (which also covers a LAN-only server).
NetInfo.configure({
  reachabilityUrl: `${API_URL}/health`,
  reachabilityTest: async (response) => response.status === 200,
  reachabilityShortTimeout: 5_000,
  reachabilityLongTimeout: 30_000,
  useNativeReachability: false,
});

onlineManager.setEventListener((setOnline) => {
  const apply = () => {
    const { networkOnline, forcedOffline } = useSyncStore.getState();
    setOnline(networkOnline && !forcedOffline);
  };

  const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    useSyncStore.getState().setNetworkOnline(state.isConnected !== false && state.isInternetReachable !== false);
    apply();
  });
  const unsubscribeStore = useSyncStore.subscribe((state, previous) => {
    if (state.forcedOffline !== previous.forcedOffline) {
      apply();
    }
  });

  return () => {
    unsubscribeNetInfo();
    unsubscribeStore();
  };
});

focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (state) => setFocused(state === 'active'));
  return () => subscription.remove();
});

function reportMutationError(
  error: Error,
  variables: unknown,
  _onMutateResult: unknown,
  mutation: Mutation<unknown, unknown, unknown>,
) {
  if (error instanceof ApiError && error.status === 401) {
    return; // The session handler takes the user back to sign-in.
  }

  const title = describeMutation(mutation.options.mutationKey, variables);
  const wasQueued = queuedMutationIds.has(mutation.mutationId);

  if (wasQueued && error instanceof ApiError && error.isRejection) {
    useSyncStore.getState().addRejected({
      id: `${mutation.mutationId}-${Date.now()}`,
      title,
      message: error.message,
      at: Date.now(),
    });
    toast.error(`Change not saved: ${title}`, error.message);
    return;
  }

  // Screens that handle their own errors (forms showing field errors, modals) opt out of the toast.
  if (!wasQueued && mutation.meta?.inlineErrors) {
    return;
  }

  toast.error(`${title} failed`, errorMessage(error));
}
