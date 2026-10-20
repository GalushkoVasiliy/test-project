import '../../global.css';
import '@/features/auth/authService';

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastHost } from '@/components/ToastHost';
import { LoadingState } from '@/components/ui/StateViews';
import { onCacheRestored, persistOptions, queryClient } from '@/query/queryClient';
import { useSessionStore } from '@/stores/session';

export default function RootLayout() {
  const status = useSessionStore((s) => s.status);

  useEffect(() => {
    void useSessionStore.getState().hydrate();
  }, []);

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions} onSuccess={onCacheRestored}>
        <StatusBar style="dark" />
        {status === 'loading' ? (
          <LoadingState label="Starting…" />
        ) : (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={status === 'signedIn'}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
            <Stack.Protected guard={status === 'signedOut'}>
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="sign-up" />
            </Stack.Protected>
          </Stack>
        )}
        <ToastHost />
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
