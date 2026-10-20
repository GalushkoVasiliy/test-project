import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import type { Unit } from '@/api/types';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Badge, Card, SectionTitle } from '@/components/ui/Card';
import { EmptyState, ErrorState, PendingState } from '@/components/ui/StateViews';
import { bedroomsLabel, formatDate, formatRent } from '@/lib/format';
import { scopes } from '@/query/keys';
import { commit, useIsSyncing } from '@/query/useChange';

import { useDeleteProperty, usePropertyDetails } from './hooks';
import { PropertyFormModal } from './PropertyFormModal';
import { UnitFormModal } from './UnitFormModal';

export function PropertyDetailsScreen({ id }: { id: string }) {
  const property = usePropertyDetails(id);
  const remove = useDeleteProperty();
  const syncing = useIsSyncing(scopes.property(id));
  const [editing, setEditing] = useState(false);
  const [unitModal, setUnitModal] = useState<{ unit?: Unit } | null>(null);

  if (property.isPending) {
    return <PendingState paused={property.fetchStatus === 'paused'} />;
  }
  if (!property.data) {
    return <ErrorState error={property.error} onRetry={() => property.refetch()} />;
  }

  const p = property.data;

  const onRemove = () =>
    Alert.alert(
      `Remove ${p.name}?`,
      'Its units are removed too. Properties with open applications or leases cannot be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            router.back();
            await commit(remove.mutateAsync({ id: p.id, name: p.name })).catch(() => undefined);
          },
        },
      ],
    );

  return (
    <Screen scroll refreshing={property.isRefetching} onRefresh={() => property.refetch()}>
      <Stack.Screen options={{ title: p.name }} />
      <Card>
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-slate-900">{p.name}</Text>
            <Text className="mt-0.5 text-slate-500">
              {p.address}, {p.city}
            </Text>
          </View>
          {syncing ? <Badge label="Waiting to sync" tone="amber" /> : null}
        </View>
        <View className="mt-4 flex-row">
          <Button
            title="Edit"
            variant="secondary"
            size="sm"
            icon="create-outline"
            className="mr-2"
            onPress={() => setEditing(true)}
          />
          <Button title="Remove" variant="ghost" size="sm" icon="trash-outline" onPress={onRemove} />
        </View>
      </Card>

      <SectionTitle
        right={<Button title="Add unit" size="sm" variant="ghost" icon="add" onPress={() => setUnitModal({})} />}
      >
        Units ({p.units.length})
      </SectionTitle>
      {p.units.length === 0 ? (
        <EmptyState icon="grid-outline" title="No units yet" message="Add the units of this property." />
      ) : (
        p.units.map((unit) => <UnitRow key={unit.id} unit={unit} onPress={() => setUnitModal({ unit })} />)
      )}

      <PropertyFormModal visible={editing} onClose={() => setEditing(false)} property={p} />
      <UnitFormModal
        visible={unitModal !== null}
        onClose={() => setUnitModal(null)}
        propertyId={p.id}
        unit={unitModal?.unit}
      />
    </Screen>
  );
}

function UnitRow({ unit, onPress }: { unit: Unit; onPress: () => void }) {
  const lease = unit.currentLease;
  return (
    <Card onPress={onPress} accessibilityLabel={`Unit ${unit.unitNumber}`}>
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-base font-semibold text-slate-900">Unit {unit.unitNumber}</Text>
          <Text className="mt-0.5 text-sm text-slate-500">
            {bedroomsLabel(unit.bedrooms)} · {unit.unitTypeName}
            {unit.unitTypeIsActive ? '' : ' (inactive type)'}
          </Text>
          {lease ? (
            <Text className="mt-1 text-sm text-slate-600">
              Lease {formatDate(lease.startDate)} – {formatDate(lease.endDate)}
            </Text>
          ) : null}
          {unit.openApplicationCount > 0 ? (
            <Text className="mt-1 text-sm text-slate-600">
              {unit.openApplicationCount} open application{unit.openApplicationCount === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
        <View className="items-end">
          <Text className="font-semibold text-slate-900">{formatRent(unit.monthlyRent)}</Text>
          <View className="mt-1">
            <Badge label={unit.isAvailable ? 'Available' : 'Leased'} tone={unit.isAvailable ? 'green' : 'indigo'} />
          </View>
        </View>
      </View>
    </Card>
  );
}
