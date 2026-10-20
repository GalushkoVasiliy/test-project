import { useState } from 'react';
import { Text, View } from 'react-native';

import { errorMessage } from '@/api/errors';
import type { ApplicationViewModel, StatusChange } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card, SectionTitle } from '@/components/ui/Card';
import { TextField } from '@/components/ui/TextField';
import { FormError } from '@/features/auth/AuthLayout';
import { formatDateTime } from '@/lib/format';
import { commit } from '@/query/useChange';
import { toast } from '@/stores/toast';

import { useClaimApplication, useReleaseApplication, useUpdateNotes } from '../hooks';
import { ReviewModal } from './ReviewModal';
import { statusLabel } from './StatusBadge';

/** Review queue actions, internal notes and the status history. Property managers only. */
export function ManagerPanel({ vm }: { vm: ApplicationViewModel }) {
  const claim = useClaimApplication();
  const release = useReleaseApplication();
  const [reviewing, setReviewing] = useState(false);
  const { permissions } = vm;

  const run = async (change: Promise<unknown>, done: string) => {
    try {
      const result = await commit(change);
      toast.success(
        result.queued ? 'Saved on this device' : done,
        result.queued ? 'It will sync when you’re back online.' : undefined,
      );
    } catch {
      // Reported by the global mutation error handler.
    }
  };

  const reviewedByOther = vm.status === 'UnderReview' && !permissions.canReview;

  return (
    <View>
      <SectionTitle>Review</SectionTitle>
      <Card>
        {permissions.canClaim ? (
          <>
            <Text className="mb-3 text-sm text-slate-600">This application is waiting in the review queue.</Text>
            <Button
              title="Claim for review"
              icon="hand-left-outline"
              loading={claim.isPending}
              onPress={() => run(claim.mutateAsync({ applicationId: vm.id }), 'Claimed for review')}
            />
          </>
        ) : permissions.canReview ? (
          <>
            <Text className="mb-3 text-sm text-slate-600">You are reviewing this application.</Text>
            <Button title="Complete review" icon="checkmark-done-outline" onPress={() => setReviewing(true)} />
            <Button
              title="Release to queue"
              variant="ghost"
              className="mt-2"
              loading={release.isPending}
              onPress={() => run(release.mutateAsync({ applicationId: vm.id }), 'Released to the queue')}
            />
          </>
        ) : reviewedByOther ? (
          <Text className="text-sm text-slate-600">
            Being reviewed by {vm.reviewer?.fullName ?? 'another manager'}.
          </Text>
        ) : (
          <Text className="text-sm text-slate-600">
            {vm.status === 'Draft' || vm.status === 'Returned'
              ? 'Waiting for the applicant to submit.'
              : `No review actions — the application is ${statusLabel(vm.status).toLowerCase()}.`}
          </Text>
        )}
      </Card>

      {/* Keyed by version: the editor starts over from the saved notes whenever they change. */}
      {permissions.canEditNotes ? <ManagerNotes key={vm.managerNotes?.version ?? 0} vm={vm} /> : null}

      {vm.history ? <History entries={vm.history} /> : null}

      <ReviewModal vm={vm} visible={reviewing} onClose={() => setReviewing(false)} />
    </View>
  );
}

function ManagerNotes({ vm }: { vm: ApplicationViewModel }) {
  const save = useUpdateNotes();
  const saved = vm.managerNotes?.text ?? '';
  const [text, setText] = useState(saved);
  const [error, setError] = useState<string | null>(null);

  const onSave = async () => {
    setError(null);
    try {
      const result = await commit(
        save.mutateAsync({ applicationId: vm.id, text, baseVersion: vm.managerNotes?.version ?? 0 }),
      );
      toast.success(result.queued ? 'Notes saved on this device' : 'Notes saved');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <>
      <SectionTitle>Internal notes</SectionTitle>
      <Card>
        <TextField
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Visible to property managers only"
          containerClassName="mb-3"
        />
        <FormError message={error} />
        <Button
          title="Save notes"
          size="sm"
          variant="secondary"
          className="self-start"
          disabled={text === saved}
          loading={save.isPending}
          onPress={onSave}
        />
      </Card>
    </>
  );
}

function History({ entries }: { entries: StatusChange[] }) {
  return (
    <>
      <SectionTitle>History</SectionTitle>
      <Card>
        {entries.map((entry, index) => (
          <View key={entry.id} className="flex-row">
            <View className="mr-3 items-center">
              <View className="mt-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
              {index < entries.length - 1 ? <View className="w-px flex-1 bg-slate-200" /> : null}
            </View>
            <View className="flex-1 pb-4">
              <Text className="font-medium text-slate-900">
                {entry.fromStatus ? `${statusLabel(entry.fromStatus)} → ${statusLabel(entry.toStatus)}` : 'Started'}
                {entry.outcome ? ` · ${entry.outcome}` : ''}
              </Text>
              <Text className="text-xs text-slate-500">
                {entry.changedByName} · {formatDateTime(entry.changedAt)}
              </Text>
              {entry.comment ? <Text className="mt-1 text-sm italic text-slate-700">“{entry.comment}”</Text> : null}
            </View>
          </View>
        ))}
      </Card>
    </>
  );
}
