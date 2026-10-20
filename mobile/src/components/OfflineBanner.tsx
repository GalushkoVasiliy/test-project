import { Ionicons } from '@expo/vector-icons';
import { useMutationState } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { useIsOnline } from '@/stores/sync';

/** Number of changes made on this device that the server has not confirmed yet. */
export function usePendingChangesCount(): number {
  return useMutationState({ filters: { status: 'pending' }, select: (m) => m.mutationId }).length;
}

/** Tells the user when they are offline and how many changes are waiting to sync. */
export function OfflineBanner() {
  const online = useIsOnline();
  const pending = usePendingChangesCount();

  if (online && pending === 0) {
    return null;
  }

  const changes = `${pending} change${pending === 1 ? '' : 's'}`;
  const message = online
    ? `Syncing ${changes}…`
    : pending > 0
      ? `You’re offline · ${changes} waiting to sync`
      : 'You’re offline · showing saved data';

  return (
    <View
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      className={
        online ? 'flex-row items-center bg-amber-500 px-4 py-2' : 'flex-row items-center bg-slate-800 px-4 py-2'
      }
    >
      <Ionicons name={online ? 'sync' : 'cloud-offline'} size={16} color="#ffffff" />
      <Text className="ml-2 flex-1 text-sm font-medium text-white">{message}</Text>
    </View>
  );
}
