import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { unitsApi } from '@/api/endpoints';
import type { AvailableUnit } from '@/api/types';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { EmptyState, ErrorState, PendingState } from '@/components/ui/StateViews';
import { useStartApplication } from '@/features/applications/hooks';
import { useProperties } from '@/features/properties/hooks';
import { bedroomsLabel, formatRent } from '@/lib/format';
import { newId } from '@/lib/ids';
import { queryKeys } from '@/query/keys';
import { useFiltersStore } from '@/stores/filters';

const BEDROOM_OPTIONS = [
  { value: null, label: 'Any size' },
  { value: 1, label: '1+ beds' },
  { value: 2, label: '2+ beds' },
  { value: 3, label: '3+ beds' },
];

export function AvailableUnitsScreen() {
  const filters = useFiltersStore((s) => s.units);
  const setFilters = useFiltersStore((s) => s.setUnitFilters);
  const properties = useProperties();
  const units = useQuery({
    queryKey: queryKeys.units.available(filters),
    queryFn: () => unitsApi.available(filters),
  });
  const start = useStartApplication();

  const apply = (unit: AvailableUnit) => {
    const id = newId();
    // The draft appears immediately (also offline); the detail screen waits for the create to sync.
    start.mutateAsync({ id, unit }).catch(() => undefined);
    router.push(`/applications/${id}`);
  };

  const header = (
    <View className="mb-2">
      <ChipGroup
        scroll
        value={filters.propertyId}
        onChange={(propertyId) => setFilters({ propertyId })}
        options={[
          { value: null, label: 'All properties' },
          ...(properties.data ?? []).map((p) => ({ value: p.id, label: p.name })),
        ]}
      />
      <ChipGroup
        scroll
        value={filters.minBedrooms}
        onChange={(minBedrooms) => setFilters({ minBedrooms })}
        options={BEDROOM_OPTIONS}
      />
    </View>
  );

  return (
    <Screen>
      {units.isPending ? (
        <PendingState paused={units.fetchStatus === 'paused'} />
      ) : units.isError && !units.data ? (
        <ErrorState error={units.error} onRetry={() => units.refetch()} />
      ) : (
        <FlatList
          data={units.data}
          keyExtractor={(u) => u.id}
          contentContainerClassName="p-4 pb-12"
          ListHeaderComponent={header}
          refreshControl={<RefreshControl refreshing={units.isRefetching} onRefresh={() => void units.refetch()} />}
          ListEmptyComponent={
            <EmptyState
              icon="home-outline"
              title="No available units"
              message="Try different filters or check back later."
            />
          }
          renderItem={({ item }) => (
            <Card>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-base font-semibold text-slate-900">
                    {item.propertyName} · Unit {item.unitNumber}
                  </Text>
                  <Text className="mt-0.5 text-sm text-slate-500">
                    {item.propertyAddress}, {item.city}
                  </Text>
                  <Text className="mt-2 text-sm text-slate-700">
                    {bedroomsLabel(item.bedrooms)} · {item.unitTypeName}
                  </Text>
                </View>
                <Text className="text-base font-bold text-slate-900">{formatRent(item.monthlyRent)}</Text>
              </View>
              <Button
                title="Apply"
                size="sm"
                className="mt-3 self-start"
                icon="document-text-outline"
                onPress={() => apply(item)}
              />
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
