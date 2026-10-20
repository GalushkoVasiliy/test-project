import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { PropertyDetails } from '@/api/types';
import { AppModal } from '@/components/ui/AppModal';
import { Button } from '@/components/ui/Button';
import { FormTextField } from '@/components/ui/TextField';
import { FormError } from '@/features/auth/AuthLayout';
import { newId } from '@/lib/ids';
import { applyServerErrors } from '@/lib/serverErrors';
import { commit } from '@/query/useChange';
import { toast } from '@/stores/toast';

import { useCreateProperty, useUpdateProperty } from './hooks';
import { propertySchema, type PropertyForm } from './schemas';

const FIELDS = ['name', 'address', 'city'] as const;

interface PropertyFormModalProps {
  visible: boolean;
  onClose: () => void;
  /** Edit this property; create a new one when omitted. */
  property?: PropertyDetails;
  onCreated?: (id: string) => void;
}

export function PropertyFormModal({ visible, onClose, property, onCreated }: PropertyFormModalProps) {
  const create = useCreateProperty();
  const update = useUpdateProperty();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, reset, setError, formState } = useForm<PropertyForm>({
    resolver: zodResolver(propertySchema),
  });

  useEffect(() => {
    if (visible) {
      reset({ name: property?.name ?? '', address: property?.address ?? '', city: property?.city ?? '' });
    }
  }, [visible, property, reset]);

  const close = () => {
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (input) => {
    setFormError(null);
    try {
      if (property) {
        const result = await commit(update.mutateAsync({ id: property.id, input, baseVersion: property.version }));
        toast.success(
          result.queued ? 'Saved on this device' : 'Property updated',
          result.queued ? 'It will sync when you’re back online.' : undefined,
        );
      } else {
        const id = newId();
        const result = await commit(create.mutateAsync({ id, input }));
        toast.success(
          result.queued ? 'Saved on this device' : 'Property added',
          result.queued ? 'It will sync when you’re back online.' : undefined,
        );
        onCreated?.(id);
      }
      close();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, FIELDS)[0] ?? null);
    }
  });

  return (
    <AppModal
      visible={visible}
      title={property ? 'Edit property' : 'Add property'}
      onClose={close}
      footer={
        <Button
          title={property ? 'Save changes' : 'Add property'}
          onPress={onSubmit}
          loading={formState.isSubmitting}
        />
      }
    >
      <FormTextField control={control} name="name" label="Name" placeholder="e.g. Maple Court Apartments" />
      <FormTextField control={control} name="address" label="Address" placeholder="Street and number" />
      <FormTextField control={control} name="city" label="City" />
      <FormError message={formError} />
    </AppModal>
  );
}
