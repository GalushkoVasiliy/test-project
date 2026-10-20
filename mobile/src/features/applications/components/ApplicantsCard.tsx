import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import type { ApplicantSummary, ApplicationViewModel } from '@/api/types';
import { AppModal } from '@/components/ui/AppModal';
import { Button } from '@/components/ui/Button';
import { Badge, Card } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { FormError } from '@/features/auth/AuthLayout';
import { commit } from '@/query/useChange';
import { useCurrentUser } from '@/stores/session';
import { toast } from '@/stores/toast';

import { useAddApplicant, useRemoveApplicant } from '../hooks';

/** Everyone on the application has the same rights; up to four applicants in total. */
const MAX_APPLICANTS = 4;

export function ApplicantsCard({ vm }: { vm: ApplicationViewModel }) {
  const me = useCurrentUser();
  const [managing, setManaging] = useState(false);
  const names = vm.applicants.map((a) => (a.id === me?.id ? `${a.fullName} (you)` : a.fullName)).join(', ');

  return (
    <Card>
      <View className="flex-row items-center">
        <Ionicons name="people-outline" size={20} color="#475569" />
        <View className="ml-3 flex-1">
          <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Applicant{vm.applicants.length === 1 ? '' : 's'}
          </Text>
          <Text className="text-sm text-slate-900">{names}</Text>
        </View>
        {vm.permissions.canManageApplicants ? (
          <Button title="Manage" size="sm" variant="ghost" onPress={() => setManaging(true)} />
        ) : null}
      </View>
      <ManageApplicantsModal vm={vm} visible={managing} onClose={() => setManaging(false)} />
    </Card>
  );
}

function ManageApplicantsModal({
  vm,
  visible,
  onClose,
}: {
  vm: ApplicationViewModel;
  visible: boolean;
  onClose: () => void;
}) {
  const me = useCurrentUser();
  const add = useAddApplicant();
  const remove = useRemoveApplicant();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canAdd = vm.applicants.length < MAX_APPLICANTS;

  const onAdd = async () => {
    setError(null);
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter the email of their account.');
      return;
    }
    try {
      const result = await commit(add.mutateAsync({ applicationId: vm.id, email: value }));
      setEmail('');
      toast.success(
        result.queued ? 'Saved on this device' : 'Co-applicant added',
        result.queued ? 'It will sync when you’re back online.' : undefined,
      );
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const onRemove = (applicant: ApplicantSummary) => {
    const leaving = applicant.id === me?.id;
    Alert.alert(
      leaving ? 'Leave this application?' : `Remove ${applicant.fullName}?`,
      leaving ? 'You will no longer see or edit it.' : 'They will no longer see or edit this application.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: leaving ? 'Leave' : 'Remove',
          style: 'destructive',
          onPress: () => {
            if (leaving) {
              onClose();
              router.back();
            }
            remove
              .mutateAsync({ applicationId: vm.id, applicantId: applicant.id, name: applicant.fullName, leaving })
              .catch(() => undefined); // Reported by the global mutation error handler.
          },
        },
      ],
    );
  };

  return (
    <AppModal visible={visible} title="Applicants" onClose={onClose}>
      <Text className="mb-4 text-sm text-slate-600">
        Everyone on the application can view, edit, submit and withdraw it. Co-applicants need their own applicant
        account.
      </Text>
      {vm.applicants.map((applicant) => (
        <View key={applicant.id} className="mb-2 flex-row items-center rounded-xl border border-slate-200 bg-white p-3">
          <View className="flex-1">
            <Text className="font-medium text-slate-900">
              {applicant.fullName}
              {applicant.id === me?.id ? ' (you)' : ''}
            </Text>
            {applicant.email ? <Text className="text-sm text-slate-500">{applicant.email}</Text> : null}
          </View>
          {applicant.isPrimary ? <Badge label="Primary" tone="indigo" /> : null}
          {applicant.id.startsWith('pending:') ? <Badge label="Waiting to sync" tone="amber" /> : null}
          {applicant.canRemove ? (
            <Pressable
              onPress={() => onRemove(applicant)}
              hitSlop={10}
              className="ml-2 p-1"
              accessibilityRole="button"
              accessibilityLabel={applicant.id === me?.id ? 'Leave application' : `Remove ${applicant.fullName}`}
            >
              <Ionicons
                name={applicant.id === me?.id ? 'exit-outline' : 'person-remove-outline'}
                size={20}
                color="#dc2626"
              />
            </Pressable>
          ) : null}
        </View>
      ))}

      {canAdd ? (
        <View className="mt-4">
          <TextField
            label="Add a co-applicant"
            placeholder="Their account email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            error={error ?? undefined}
          />
          <Button title="Add co-applicant" icon="person-add-outline" onPress={onAdd} loading={add.isPending} />
        </View>
      ) : (
        <FormError message={`An application can have at most ${MAX_APPLICANTS} applicants.`} />
      )}
    </AppModal>
  );
}
