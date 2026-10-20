import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerTintColor: '#4f46e5',
        headerTitleStyle: { color: '#0f172a' },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: '#f8fafc' },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="applications/[id]" options={{ title: 'Application' }} />
      <Stack.Screen name="properties/[id]" options={{ title: 'Property' }} />
    </Stack>
  );
}
