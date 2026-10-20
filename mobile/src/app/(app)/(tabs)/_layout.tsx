import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useIsManager } from '@/stores/session';
import { useSyncStore } from '@/stores/sync';

/** The first tab depends on the role: managers maintain properties, applicants browse available units. */
export default function TabsLayout() {
  const isManager = useIsManager();
  const rejectedCount = useSyncStore((s) => s.rejected.length);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#64748b',
        headerTitleStyle: { color: '#0f172a' },
        sceneStyle: { backgroundColor: '#f8fafc' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: isManager ? 'Properties' : 'Find a home',
          tabBarLabel: isManager ? 'Properties' : 'Browse',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={isManager ? 'business-outline' : 'search-outline'} color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Applications',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarBadge: rejectedCount > 0 ? rejectedCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
