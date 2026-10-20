import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PendingState } from '@/components/ui/StateViews';

import { useProperties } from './hooks';
import { PropertyFormModal } from './PropertyFormModal';

export function PropertiesScreen() {
  const properties = useProperties();
  const [adding, setAdding] = useState(false);

  return (
    <Screen>
      {properties.isPending ? (
        <PendingState paused={properties.fetchStatus === 'paused'} />
      ) : properties.isError && !properties.data ? (
        <ErrorState error={properties.error} onRetry={() => properties.refetch()} />
      ) : (
        <FlatList
          data={properties.data}
          keyExtractor={(p) => p.id}
          contentContainerClassName="p-4 pb-12"
          refreshControl={
            <RefreshControl refreshing={properties.isRefetching} onRefresh={() => void properties.refetch()} />
          }
          ListHeaderComponent={
            <Button title="Add property" icon="add" className="mb-4" onPress={() => setAdding(true)} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="business-outline"
              title="No properties yet"
              message="Add your first property to start listing units."
            />
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push(`/properties/${item.id}`)} accessibilityLabel={item.name}>
              <View className="flex-row items-center">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-slate-900">{item.name}</Text>
                  <Text className="mt-0.5 text-sm text-slate-500">
                    {item.address}, {item.city}
                  </Text>
                  <Text className="mt-2 text-sm text-slate-700">
                    {item.unitCount} unit{item.unitCount === 1 ? '' : 's'} · {item.availableUnitCount} available
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
              </View>
            </Card>
          )}
        />
      )}
      <PropertyFormModal visible={adding} onClose={() => setAdding(false)} />
    </Screen>
  );
}
