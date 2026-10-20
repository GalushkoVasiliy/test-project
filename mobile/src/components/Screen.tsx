import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { OfflineBanner } from './OfflineBanner';

interface ScreenProps {
  children: ReactNode;
  /** Wrap the content in a ScrollView with padding. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Every screen gets the offline / sync banner right under its header. */
export function Screen({ children, scroll, refreshing = false, onRefresh }: ScreenProps) {
  return (
    <View className="flex-1 bg-slate-50">
      <OfflineBanner />
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-12"
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
}
