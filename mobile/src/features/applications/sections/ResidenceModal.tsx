import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Text, View } from 'react-native';

import type { Residence } from '@/api/types';
import { AppModal } from '@/components/ui/AppModal';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { FormTextField } from '@/components/ui/TextField';
import { fromDateOnly } from '@/lib/dates';
import { newId } from '@/lib/ids';

import { fromResidenceForm, residenceSchema, toResidenceForm, type ResidenceForm } from '../schemas';

interface ResidenceModalProps {
  visible: boolean;
  /** Edit this residence; add a new one when omitted. */
  residence?: Residence;
  onClose: () => void;
  onSave: (residence: Residence) => void;
}

/**
 * Adds or edits one residence in the local list; nothing is sent until the section is saved. Errors
 * show as you go, but incomplete details can still be kept for a draft — Continue will not accept them.
 */
export function ResidenceModal({ visible, residence, onClose, onSave }: ResidenceModalProps) {
  const [emptyError, setEmptyError] = useState(false);
  const { control, getValues, reset, trigger } = useForm<ResidenceForm>({
    resolver: zodResolver(residenceSchema),
    mode: 'onTouched',
  });

  useEffect(() => {
    if (visible) {
      const values = residence
        ? toResidenceForm(residence)
        : { id: newId(), address: '', landlordName: '', landlordPhone: '', moveInDate: '', moveOutDate: '' };
      reset(values);
      // Show what is still missing on an existing (draft) residence right away.
      if (residence) void trigger();
    }
  }, [visible, residence, reset, trigger]);

  const moveIn = useWatch({ control, name: 'moveInDate' });

  const close = () => {
    setEmptyError(false);
    onClose();
  };

  const onSubmit = () => {
    const value = fromResidenceForm(getValues());
    const { id: _, ...details } = value;
    if (Object.values(details).every((v) => v === null)) {
      setEmptyError(true);
      return;
    }
    onSave(value);
    close();
  };

  return (
    <AppModal
      visible={visible}
      title={residence ? 'Edit residence' : 'Add residence'}
      onClose={close}
      footer={
        <View>
          {emptyError ? (
            <Text className="mb-2 text-center text-sm text-red-600">Enter at least one detail.</Text>
          ) : null}
          <Button title={residence ? 'Save residence' : 'Add residence'} onPress={onSubmit} />
        </View>
      }
    >
      <FormTextField control={control} name="address" label="Address" multiline maxLength={200} />
      <FormTextField control={control} name="landlordName" label="Landlord name" autoComplete="name" maxLength={100} />
      <FormTextField
        control={control}
        name="landlordPhone"
        label="Landlord phone"
        keyboardType="phone-pad"
        maxLength={30}
      />
      <Controller
        control={control}
        name="moveInDate"
        render={({ field, fieldState }) => (
          <DateField
            label="Move-in date"
            value={field.value}
            onChange={(v) => {
              field.onChange(v);
              void trigger('moveOutDate');
            }}
            error={fieldState.error?.message}
            maximumDate={new Date()}
          />
        )}
      />
      <Controller
        control={control}
        name="moveOutDate"
        render={({ field, fieldState }) => (
          <DateField
            label="Move-out date"
            value={field.value}
            onChange={(v) => {
              field.onChange(v);
              void trigger('moveOutDate');
            }}
            error={fieldState.error?.message}
            minimumDate={moveIn ? fromDateOnly(moveIn) : undefined}
            maximumDate={new Date()}
          />
        )}
      />
      <Text className="text-xs text-slate-500">
        Missing details can be completed later; the section can’t be continued until they are.
      </Text>
    </AppModal>
  );
}
