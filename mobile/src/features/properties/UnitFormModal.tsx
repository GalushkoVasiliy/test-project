import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Text, View } from 'react-native';

import type { Unit } from '@/api/types';
import { AppModal } from '@/components/ui/AppModal';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { FormTextField } from '@/components/ui/TextField';
import { FormError } from '@/features/auth/AuthLayout';
import { formatDate } from '@/lib/format';
import { newId } from '@/lib/ids';
import { applyServerErrors } from '@/lib/serverErrors';
import { commit } from '@/query/useChange';
import { toast } from '@/stores/toast';

import { useCreateUnit, useDeleteUnit, useUnitTypes, useUpdateUnit } from './hooks';
import { unitSchema, type UnitForm } from './schemas';

const FIELDS = ['unitNumber', 'bedrooms', 'monthlyRent', 'unitTypeId'] as const;

interface UnitFormModalProps {
  visible: boolean;
  onClose: () => void;
  propertyId: string;
  /** Edit this unit; add a new one when omitted. */
  unit?: Unit;
}

export function UnitFormModal({ visible, onClose, propertyId, unit }: UnitFormModalProps) {
  const unitTypes = useUnitTypes();
  const create = useCreateUnit();
  const update = useUpdateUnit();
  const remove = useDeleteUnit();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, reset, setError, formState } = useForm<UnitForm>({
    resolver: zodResolver(unitSchema),
  });

  useEffect(() => {
    if (visible) {
      reset({
        unitNumber: unit?.unitNumber ?? '',
        bedrooms: unit ? String(unit.bedrooms) : '1',
        monthlyRent: unit ? String(unit.monthlyRent) : '',
        unitTypeId: unit?.unitTypeId ?? 0,
      });
    }
  }, [visible, unit, reset]);

  // An inactive type stays visible (and selected) on a unit that already uses it, but cannot be picked otherwise.
  const typeOptions = (unitTypes.data ?? [])
    .filter((t) => t.isActive || t.id === unit?.unitTypeId)
    .map((t) => ({
      value: t.id,
      label: t.isActive ? t.name : `${t.name} (inactive)`,
      disabled: !t.isActive && t.id !== unit?.unitTypeId,
    }));

  const close = () => {
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const input = {
      unitNumber: values.unitNumber,
      bedrooms: Number(values.bedrooms),
      monthlyRent: Number(values.monthlyRent),
      unitTypeId: values.unitTypeId,
    };
    const unitTypeName = unitTypes.data?.find((t) => t.id === input.unitTypeId)?.name ?? '';

    try {
      const result = unit
        ? await commit(update.mutateAsync({ propertyId, id: unit.id, input, unitTypeName, baseVersion: unit.version }))
        : await commit(create.mutateAsync({ propertyId, id: newId(), input, unitTypeName }));
      toast.success(
        result.queued ? 'Saved on this device' : unit ? 'Unit updated' : 'Unit added',
        result.queued ? 'It will sync when you’re back online.' : undefined,
      );
      close();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS)[0] ?? null);
    }
  });

  const onRemove = () => {
    if (!unit) return;
    Alert.alert(`Remove unit ${unit.unitNumber}?`, 'Units with open applications or a lease cannot be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await commit(remove.mutateAsync({ propertyId, id: unit.id, unitNumber: unit.unitNumber }));
            close();
          } catch (error) {
            setFormError(applyServerErrors(error, setError, FIELDS)[0] ?? null);
          }
        },
      },
    ]);
  };

  return (
    <AppModal
      visible={visible}
      title={unit ? `Unit ${unit.unitNumber}` : 'Add unit'}
      onClose={close}
      footer={
        <View>
          <Button title={unit ? 'Save changes' : 'Add unit'} onPress={onSubmit} loading={formState.isSubmitting} />
          {unit ? (
            <Button
              title="Remove unit"
              variant="ghost"
              icon="trash-outline"
              className="mt-2"
              onPress={onRemove}
              loading={remove.isPending}
            />
          ) : null}
        </View>
      }
    >
      {unit?.currentLease ? (
        <View className="mb-4 rounded-xl bg-indigo-50 p-3">
          <Text className="text-sm text-indigo-800">
            Leased {formatDate(unit.currentLease.startDate)} – {formatDate(unit.currentLease.endDate)}
          </Text>
        </View>
      ) : null}
      <FormTextField
        control={control}
        name="unitNumber"
        label="Unit number"
        placeholder="e.g. 204"
        autoCapitalize="characters"
      />
      <View className="flex-row">
        <FormTextField
          control={control}
          name="bedrooms"
          label="Bedrooms"
          keyboardType="number-pad"
          containerClassName="mr-3 flex-1"
        />
        <FormTextField
          control={control}
          name="monthlyRent"
          label="Monthly rent ($)"
          keyboardType="decimal-pad"
          containerClassName="flex-1"
        />
      </View>
      <Controller
        control={control}
        name="unitTypeId"
        render={({ field, fieldState }) => (
          <ChipGroup
            label="Unit type"
            value={field.value}
            onChange={field.onChange}
            options={typeOptions}
            error={fieldState.error?.message}
          />
        )}
      />
      <FormError message={formError} />
    </AppModal>
  );
}
