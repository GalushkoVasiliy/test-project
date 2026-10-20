import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';

import { Button } from './Button';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <ActivityIndicator size="large" color="#4f46e5" />
      <Text className="mt-3 text-slate-500">{label}</Text>
    </View>
  );
}

/** Shown instead of a spinner when the data was never loaded and the device is offline. */
function OfflineState() {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Not available offline"
      message="This hasn’t been loaded on this device yet. It will appear when you’re back online."
    />
  );
}

/** Loading spinner, or the offline notice when the request is waiting for the network. */
export function PendingState({ paused }: { paused: boolean }) {
  return paused ? <OfflineState /> : <LoadingState />;
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
}) {
  return (
    <View className="items-center justify-center px-8 py-16">
      <Ionicons name={icon} size={40} color="#94a3b8" />
      <Text className="mt-3 text-center text-base font-semibold text-slate-700">{title}</Text>
      {message ? <Text className="mt-1 text-center text-sm text-slate-500">{message}</Text> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Ionicons name="cloud-offline-outline" size={40} color="#94a3b8" />
      <Text className="mt-3 text-center text-base font-semibold text-slate-700">Couldn’t load this</Text>
      <Text className="mt-1 text-center text-sm text-slate-500">{errorMessage(error)}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" className="mt-4" onPress={onRetry} /> : null}
    </View>
  );
}
