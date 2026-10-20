import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface RejectedChange {
  id: string;
  title: string;
  message: string;
  at: number;
}

interface SyncState {
  /** What the device reports (NetInfo). */
  networkOnline: boolean;
  /** Developer toggle that simulates being offline, handy for demos. */
  forcedOffline: boolean;
  /** Queued changes the server refused when they were replayed. */
  rejected: RejectedChange[];
  /**
   * Concurrency tokens produced by this device's own saves: entity key → (version sent → version received).
   * Lets several queued edits of the same record replay in order without tripping over each other.
   */
  versionChain: Record<string, Record<string, string>>;

  setNetworkOnline: (online: boolean) => void;
  setForcedOffline: (forced: boolean) => void;
  addRejected: (change: RejectedChange) => void;
  dismissRejected: (id: string) => void;
  clearRejected: () => void;
  recordVersion: (key: string, sent: string | number, received: string | number) => void;
  reset: () => void;
}

const MAX_REJECTED = 20;

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      networkOnline: true,
      forcedOffline: false,
      rejected: [],
      versionChain: {},

      setNetworkOnline: (networkOnline) => set({ networkOnline }),
      setForcedOffline: (forcedOffline) => set({ forcedOffline }),
      addRejected: (change) => set((s) => ({ rejected: [change, ...s.rejected].slice(0, MAX_REJECTED) })),
      dismissRejected: (id) => set((s) => ({ rejected: s.rejected.filter((c) => c.id !== id) })),
      clearRejected: () => set({ rejected: [] }),
      recordVersion: (key, sent, received) =>
        set((s) => ({
          versionChain: { ...s.versionChain, [key]: { ...s.versionChain[key], [String(sent)]: String(received) } },
        })),
      reset: () => set({ rejected: [], versionChain: {}, forcedOffline: false }),
    }),
    {
      name: 'rentals.sync',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ rejected, versionChain }) => ({ rejected, versionChain }),
    },
  ),
);

export const useIsOnline = () => useSyncStore((s) => s.networkOnline && !s.forcedOffline);

/**
 * The version a queued edit should send. An edit queued while offline was based on what the user saw
 * then; if this device has since saved the same record, follow the chain to the version that save
 * produced. A save that was rejected leaves no link, so later edits based on it are rejected too.
 */
export function resolveVersion(key: string, base: string | number): string {
  const chain = useSyncStore.getState().versionChain[key] ?? {};
  let version = String(base);
  const seen = new Set<string>();
  while (chain[version] !== undefined && !seen.has(version)) {
    seen.add(version);
    version = chain[version]!;
  }
  return version;
}
