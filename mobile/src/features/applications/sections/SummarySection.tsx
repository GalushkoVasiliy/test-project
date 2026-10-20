import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/errors';
import type { ApplicationSection, ApplicationStep, ApplicationViewModel } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormError } from '@/features/auth/AuthLayout';
import { commit } from '@/query/useChange';
import { toast } from '@/stores/toast';

import { useApplicationForm, useWithdrawApplication } from '../hooks';
import { ApplicantInfoReadOnly } from './ApplicantInfoSection';
import { residenceErrors, ResidenceItem } from './ResidencesSection';
import { SectionNav } from './SectionNav';
import { SectionStatusBadge } from './SectionStatusBadge';

interface SectionProps {
  vm: ApplicationViewModel;
  onNavigate: (step: ApplicationStep) => void;
}

interface Blocker {
  key: string;
  section: ApplicationSection;
  text: string;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name',
  phone: 'Phone',
  email: 'Email',
  currentAddress: 'Current address',
  address: 'Address',
  landlordName: 'Landlord name',
  landlordPhone: 'Landlord phone',
  moveInDate: 'Move-in date',
  moveOutDate: 'Move-out date',
};

/** "Enter a valid phone number." → "Phone: Enter a valid phone number."; messages that name the field stay as they are. */
function withField(key: string, message: string): string {
  const label = FIELD_LABELS[key.split('.').at(-1) ?? ''];
  return label && !message.toLowerCase().startsWith(label.toLowerCase()) ? `${label}: ${message}` : message;
}

/** Everything still blocking submission, worded for people, in section order. */
function blockersOf(vm: ApplicationViewModel): Blocker[] {
  const { applicantInfo, residences } = vm.sections;
  const blockers: Blocker[] = [];

  if (applicantInfo.status === 'Empty') {
    blockers.push({
      key: 'applicantInfo',
      section: 'ApplicantInfo',
      text: 'Applicant Information has not been filled in yet.',
    });
  }
  for (const [key, messages] of Object.entries(applicantInfo.errors)) {
    messages.forEach((m) => blockers.push({ key: key + m, section: 'ApplicantInfo', text: withField(key, m) }));
  }

  if (residences.status === 'Empty') {
    blockers.push({ key: 'residences', section: 'Residences', text: 'Residence History has not been filled in yet.' });
  }
  for (const message of residences.errors.residences ?? []) {
    blockers.push({ key: 'residences' + message, section: 'Residences', text: message });
  }
  residences.data.forEach((_, index) =>
    residenceErrors(residences.errors, index).forEach((m) =>
      blockers.push({ key: `residences[${index}]${m}`, section: 'Residences', text: `Residence ${index + 1}: ${m}` }),
    ),
  );

  return blockers;
}

/** Read-only view of both sections. Submit stays blocked while anything in either section is missing or invalid. */
export function SummarySection({ vm, onNavigate }: SectionProps) {
  const submit = useApplicationForm();
  const withdraw = useWithdrawApplication();
  const [error, setError] = useState<string | null>(null);
  const { applicantInfo, residences } = vm.sections;
  const blockers = vm.isEditable ? blockersOf(vm) : [];

  const onSubmit = async () => {
    setError(null);
    try {
      const result = await commit(submit.mutateAsync({ applicationId: vm.id, command: 'Submit' }));
      toast.success(
        result.queued ? 'Submitted on this device' : 'Application submitted',
        result.queued ? 'It will be sent when you’re back online.' : 'We’ll let you know when it has been reviewed.',
      );
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === 'submission_blocked'
          ? 'Some details changed — fix the items listed above.'
          : errorMessage(e),
      );
    }
  };

  const onWithdraw = () =>
    Alert.alert('Withdraw this application?', 'This cannot be undone.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            await commit(withdraw.mutateAsync({ applicationId: vm.id }));
            toast.info('Application withdrawn');
          } catch {
            // Reported by the global mutation error handler.
          }
        },
      },
    ]);

  return (
    <View>
      {blockers.length > 0 ? (
        <Card tone="warning">
          <Text className="mb-2 font-semibold text-amber-900">Before you can submit</Text>
          {blockers.map((b) => (
            <Pressable
              key={b.key}
              onPress={() => onNavigate(b.section)}
              accessibilityRole="button"
              className="flex-row items-start py-1.5"
            >
              <Ionicons name="alert-circle-outline" size={16} color="#b45309" style={{ marginTop: 2 }} />
              <Text className="ml-2 flex-1 text-sm text-amber-900">{b.text}</Text>
              <Text className="ml-2 text-sm font-semibold text-brand-600">Fix</Text>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Card>
        <SummaryHeading
          title="Applicant Information"
          status={applicantInfo.status}
          onEdit={vm.isEditable ? () => onNavigate('ApplicantInfo') : undefined}
        />
        <ApplicantInfoReadOnly vm={vm} />
      </Card>

      <Card>
        <SummaryHeading
          title="Residence History"
          status={residences.status}
          onEdit={vm.isEditable ? () => onNavigate('Residences') : undefined}
        />
        {residences.data.length === 0 ? (
          <Text className="text-sm text-slate-500">No residences listed.</Text>
        ) : (
          residences.data.map((r, index) => (
            <ResidenceItem key={r.id} residence={r} errors={residenceErrors(residences.errors, index)} />
          ))
        )}
      </Card>

      <FormError message={error} />

      <SectionNav
        onBack={vm.isEditable ? () => onNavigate('Residences') : undefined}
        onContinue={vm.permissions.canSubmit ? onSubmit : undefined}
        continueLabel={vm.status === 'Returned' ? 'Resubmit' : 'Submit application'}
        continuing={submit.isPending}
      />

      {vm.permissions.canWithdraw ? (
        <Button
          title="Withdraw application"
          variant="ghost"
          icon="exit-outline"
          onPress={onWithdraw}
          loading={withdraw.isPending}
        />
      ) : null}
    </View>
  );
}

function SummaryHeading({
  title,
  status,
  onEdit,
}: {
  title: string;
  status: ApplicationViewModel['sections']['applicantInfo']['status'];
  onEdit?: () => void;
}) {
  return (
    <View className="mb-3 flex-row items-center justify-between">
      <View>
        <Text className="text-base font-semibold text-slate-900">{title}</Text>
        <View className="mt-1">
          <SectionStatusBadge status={status} />
        </View>
      </View>
      {onEdit ? <Button title="Edit" size="sm" variant="ghost" icon="create-outline" onPress={onEdit} /> : null}
    </View>
  );
}
