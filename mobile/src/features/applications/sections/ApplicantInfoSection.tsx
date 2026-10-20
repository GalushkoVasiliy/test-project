import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Text, View } from 'react-native';

import type { SaveCommand } from '@/api/endpoints';
import type { ApplicationStep, ApplicationViewModel, FieldErrors } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { FormTextField, ReadOnlyField } from '@/components/ui/TextField';
import { FormError } from '@/features/auth/AuthLayout';
import { applyServerErrors } from '@/lib/serverErrors';
import { commit } from '@/query/useChange';
import { useCurrentUser } from '@/stores/session';
import { toast } from '@/stores/toast';

import { useApplicationForm } from '../hooks';
import {
  applicantInfoIssues,
  applicantInfoSchema,
  fromApplicantInfoForm,
  toApplicantInfoForm,
  type ApplicantInfoForm,
} from '../schemas';
import { SectionNav } from './SectionNav';
import { SectionStatusBadge } from './SectionStatusBadge';
import { isStale, StaleNotice } from './StaleNotice';

const FIELDS = ['fullName', 'phone', 'email', 'currentAddress'] as const;
const PREFIX = 'applicantInfo.';

interface SectionProps {
  vm: ApplicationViewModel;
  onNavigate: (step: ApplicationStep) => void;
}

/** Applicant Information. Renders as a form or read-only, as decided by the server (`vm.isEditable`). */
export function ApplicantInfoSection({ vm, onNavigate }: SectionProps) {
  const user = useCurrentUser();
  const save = useApplicationForm();
  const section = vm.sections.applicantInfo;
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [pending, setPending] = useState<SaveCommand | null>(null);
  const [stale, setStale] = useState(false);

  const { control, handleSubmit, getValues, setError, clearErrors } = useForm<ApplicantInfoForm>({
    resolver: zodResolver(applicantInfoSchema),
    mode: 'onTouched',
    defaultValues: toApplicantInfoForm(section.data, user ?? undefined),
  });

  const showErrors = useCallback(
    (errors: FieldErrors) => {
      for (const field of FIELDS) {
        const message = errors[PREFIX + field]?.[0];
        if (message) setError(field, { type: 'server', message });
      }
    },
    [setError],
  );

  // A draft saved with errors opens with those errors on their fields.
  useEffect(() => showErrors(section.errors), [section.errors, showErrors]);

  const run = async (command: SaveCommand, values: ApplicantInfoForm) => {
    setSectionError(null);
    setPending(command);
    const applicantInfo = fromApplicantInfoForm(values);
    try {
      const result = await commit(
        save.mutateAsync({
          applicationId: vm.id,
          command,
          section: 'ApplicantInfo',
          baseVersion: section.version,
          applicantInfo,
        }),
      );
      if (command === 'Continue') {
        onNavigate(result.queued ? 'Residences' : result.data.nextStep);
        return;
      }

      const issues = applicantInfoIssues(applicantInfo);
      clearErrors();
      showErrors(issues);
      const count = Object.keys(issues).length;
      toast.success(
        result.queued ? 'Draft saved on this device' : 'Draft saved',
        count > 0
          ? `${count} field${count === 1 ? '' : 's'} still need${count === 1 ? 's' : ''} attention before you can submit.`
          : 'This section is complete.',
      );
    } catch (error) {
      if (isStale(error)) {
        setStale(true);
        return;
      }
      // The server validates again: its field errors are shown on the fields they belong to.
      setSectionError(applyServerErrors(error, setError, FIELDS, PREFIX)[0] ?? null);
    } finally {
      setPending(null);
    }
  };

  // Continue: validate this section, save it only when valid, then show the next section.
  const onContinue = handleSubmit((values) => run('Continue', values));
  // Save draft: keep whatever was entered, errors included.
  const onSaveDraft = () => run('SaveDraft', getValues());

  return (
    <View>
      <Card>
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-base font-semibold text-slate-900">Applicant Information</Text>
          <SectionStatusBadge status={section.status} />
        </View>
        {vm.isEditable ? (
          <>
            <FormTextField
              control={control}
              name="fullName"
              label="Full name"
              autoComplete="name"
              textContentType="name"
              maxLength={100}
            />
            <FormTextField
              control={control}
              name="phone"
              label="Phone"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              maxLength={30}
            />
            <FormTextField
              control={control}
              name="email"
              label="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              maxLength={256}
            />
            <FormTextField
              control={control}
              name="currentAddress"
              label="Current address"
              autoComplete="street-address"
              multiline
              maxLength={200}
            />
            <FormError message={sectionError} />
            {stale ? <StaleNotice applicationId={vm.id} /> : null}
          </>
        ) : (
          <ApplicantInfoReadOnly vm={vm} />
        )}
      </Card>
      <SectionNav
        onContinue={vm.isEditable ? onContinue : () => onNavigate('Residences')}
        continuing={pending === 'Continue'}
        onSaveDraft={vm.isEditable ? onSaveDraft : undefined}
        savingDraft={pending === 'SaveDraft'}
      />
    </View>
  );
}

export function ApplicantInfoReadOnly({ vm }: { vm: ApplicationViewModel }) {
  const data = vm.sections.applicantInfo.data;
  if (!data) {
    return <Text className="text-sm text-slate-500">Not filled in yet.</Text>;
  }
  return (
    <>
      <ReadOnlyField label="Full name" value={data.fullName} />
      <ReadOnlyField label="Phone" value={data.phone} />
      <ReadOnlyField label="Email" value={data.email} />
      <ReadOnlyField label="Current address" value={data.currentAddress} />
    </>
  );
}
