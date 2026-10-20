import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Text } from 'react-native';

import type { ApplicationViewModel, ReviewOutcome } from '@/api/types';
import { AppModal } from '@/components/ui/AppModal';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { DateField } from '@/components/ui/DateField';
import { FormTextField } from '@/components/ui/TextField';
import { FormError } from '@/features/auth/AuthLayout';
import { today } from '@/lib/dates';
import { applyServerErrors } from '@/lib/serverErrors';
import { commit } from '@/query/useChange';
import { toast } from '@/stores/toast';

import { useReviewApplication } from '../hooks';
import { reviewSchema, type ReviewForm } from '../schemas';

const FIELDS = ['outcome', 'comment', 'leaseStartDate'] as const;

const actionLabel: Record<ReviewOutcome, string> = {
  Approve: 'Approve and issue lease',
  Return: 'Return to applicant',
  Deny: 'Deny application',
};

export function ReviewModal({
  vm,
  visible,
  onClose,
}: {
  vm: ApplicationViewModel;
  visible: boolean;
  onClose: () => void;
}) {
  const review = useReviewApplication();
  const [formError, setFormError] = useState<string | null>(null);
  const { control, handleSubmit, reset, setError, formState } = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
  });

  useEffect(() => {
    if (visible) {
      reset({ outcome: 'Approve', comment: '', leaseStartDate: today() });
    }
  }, [visible, reset]);

  const outcome = useWatch({ control, name: 'outcome' });

  const close = () => {
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await commit(
        review.mutateAsync({
          applicationId: vm.id,
          outcome: values.outcome,
          comment: values.comment || undefined,
          leaseStartDate: values.outcome === 'Approve' ? values.leaseStartDate : undefined,
        }),
      );
      toast.success(
        result.queued ? 'Review saved on this device' : 'Review completed',
        result.queued ? 'It will sync when you’re back online.' : undefined,
      );
      close();
    } catch (error) {
      // e.g. the unit got leased in the meantime: the approval is rejected and the message shown here.
      setFormError(applyServerErrors(error, setError, FIELDS)[0] ?? null);
    }
  });

  return (
    <AppModal
      visible={visible}
      title="Complete review"
      onClose={close}
      footer={
        <Button
          title={outcome ? actionLabel[outcome] : 'Complete review'}
          variant={outcome === 'Deny' ? 'danger' : 'primary'}
          onPress={onSubmit}
          loading={formState.isSubmitting}
        />
      }
    >
      <Text className="mb-4 text-sm text-slate-600">
        {vm.applicant.fullName} · {vm.unit.propertyName}, unit {vm.unit.unitNumber}
      </Text>
      <Controller
        control={control}
        name="outcome"
        render={({ field }) => (
          <ChipGroup
            label="Outcome"
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: 'Approve', label: 'Approve' },
              { value: 'Return', label: 'Return' },
              { value: 'Deny', label: 'Deny' },
            ]}
          />
        )}
      />
      {outcome === 'Approve' ? (
        <Controller
          control={control}
          name="leaseStartDate"
          render={({ field, fieldState }) => (
            <DateField
              label="Lease start date (12-month term)"
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              minimumDate={new Date()}
            />
          )}
        />
      ) : null}
      <FormTextField
        control={control}
        name="comment"
        label={outcome === 'Approve' ? 'Comment (optional)' : 'Comment (required)'}
        placeholder={outcome === 'Return' ? 'What should the applicant correct?' : undefined}
        multiline
      />
      <FormError message={formError} />
    </AppModal>
  );
}
