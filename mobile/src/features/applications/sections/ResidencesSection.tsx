import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/errors';
import type { SaveCommand } from '@/api/endpoints';
import type { ApplicationStep, ApplicationViewModel, FieldErrors, Residence } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormError } from '@/features/auth/AuthLayout';
import { formatDate } from '@/lib/format';
import { sortResidences } from '@/query/mutations';
import { commit } from '@/query/useChange';
import { toast } from '@/stores/toast';

import { useApplicationForm } from '../hooks';
import { MAX_RESIDENCES, residencesIssues } from '../schemas';
import { ResidenceModal } from './ResidenceModal';
import { SectionNav } from './SectionNav';
import { SectionStatusBadge } from './SectionStatusBadge';
import { isStale, StaleNotice } from './StaleNotice';

interface SectionProps {
  vm: ApplicationViewModel;
  onNavigate: (step: ApplicationStep) => void;
}

/** Errors for the item at `index`, from field-path keyed errors such as "residences[2].address". */
export function residenceErrors(errors: FieldErrors, index: number): string[] {
  const prefix = `residences[${index}].`;
  return Object.entries(errors).flatMap(([key, messages]) => (key.startsWith(prefix) ? messages : []));
}

/**
 * Residence History. Residences are edited in a modal; the whole list is saved by Continue (only when
 * every residence is complete) or by Save draft (as it is).
 */
export function ResidencesSection({ vm, onNavigate }: SectionProps) {
  const save = useApplicationForm();
  const section = vm.sections.residences;
  const [items, setItems] = useState<Residence[]>(section.data);
  const [modal, setModal] = useState<{ residence?: Residence } | null>(null);
  const [attempted, setAttempted] = useState(section.isSaved);
  const [sectionError, setSectionError] = useState<string | null>(null);
  const [pending, setPending] = useState<SaveCommand | null>(null);
  const [stale, setStale] = useState(false);

  // The same rules as the server, applied as the list changes. Keys refer to positions in `items`.
  const issues = useMemo(() => residencesIssues(items), [items]);
  const listError = attempted ? issues.residences?.[0] : undefined;

  const upsert = (residence: Residence) => {
    setItems((current) =>
      sortResidences(
        current.some((r) => r.id === residence.id)
          ? current.map((r) => (r.id === residence.id ? residence : r))
          : [...current, residence],
      ),
    );
    setSectionError(null);
  };

  const remove = (residence: Residence) =>
    Alert.alert('Remove this residence?', residence.address ?? undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setItems((current) => current.filter((r) => r.id !== residence.id)),
      },
    ]);

  const run = async (command: SaveCommand) => {
    setSectionError(null);
    setPending(command);
    try {
      const result = await commit(
        save.mutateAsync({
          applicationId: vm.id,
          command,
          section: 'Residences',
          baseVersion: section.version,
          residences: items,
        }),
      );
      if (command === 'Continue') {
        onNavigate(result.queued ? 'Summary' : result.data.nextStep);
        return;
      }

      const count = Object.keys(issues).length;
      toast.success(
        result.queued ? 'Draft saved on this device' : 'Draft saved',
        count > 0 ? 'Some residences still need details before you can submit.' : 'This section is complete.',
      );
    } catch (error) {
      if (isStale(error)) {
        setStale(true);
        return;
      }
      setSectionError(
        error instanceof ApiError && error.isValidation ? 'Fix the highlighted residences.' : errorMessage(error),
      );
    } finally {
      setPending(null);
    }
  };

  // Continue: the list must pass every rule; it is saved only then, and the Summary is shown.
  const onContinue = () => {
    setAttempted(true);
    if (Object.keys(issues).length > 0) {
      setSectionError(
        issues.residences?.[0] ?? 'Complete the highlighted residences, or save a draft and finish later.',
      );
      return;
    }
    void run('Continue');
  };

  const editable = vm.isEditable;
  const shown = editable ? items : section.data;
  const shownErrors = editable ? issues : section.errors;

  return (
    <View>
      <Card>
        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text className="text-base font-semibold text-slate-900">Residence History</Text>
            <View className="mt-1">
              <SectionStatusBadge status={section.status} />
            </View>
          </View>
          {editable && items.length < MAX_RESIDENCES ? (
            <Button title="Add" size="sm" variant="ghost" icon="add" onPress={() => setModal({})} />
          ) : null}
        </View>

        {shown.length === 0 ? (
          <Text className="py-2 text-sm text-slate-500">
            {editable ? 'List the places you lived before your current address.' : 'No residences listed.'}
          </Text>
        ) : (
          shown.map((residence, index) => (
            <ResidenceItem
              key={residence.id}
              residence={residence}
              errors={residenceErrors(shownErrors, index)}
              onEdit={editable ? () => setModal({ residence }) : undefined}
              onRemove={editable ? () => remove(residence) : undefined}
            />
          ))
        )}
        <FormError message={sectionError ?? listError ?? null} />
        {stale ? <StaleNotice applicationId={vm.id} /> : null}
      </Card>

      <SectionNav
        onBack={() => onNavigate('ApplicantInfo')}
        onContinue={editable ? onContinue : () => onNavigate('Summary')}
        continuing={pending === 'Continue'}
        onSaveDraft={editable ? () => void run('SaveDraft') : undefined}
        savingDraft={pending === 'SaveDraft'}
      />

      <ResidenceModal
        visible={modal !== null}
        residence={modal?.residence}
        onClose={() => setModal(null)}
        onSave={upsert}
      />
    </View>
  );
}

export function ResidenceItem({
  residence,
  errors,
  onEdit,
  onRemove,
}: {
  residence: Residence;
  errors?: string[];
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  return (
    <View
      className={
        errors?.length
          ? 'mb-2 rounded-xl border border-amber-300 bg-amber-50 p-3'
          : 'mb-2 rounded-xl border border-slate-200 bg-slate-50 p-3'
      }
    >
      <View className="flex-row items-start">
        <View className="flex-1">
          <Text className="font-medium text-slate-900">{residence.address || 'Address missing'}</Text>
          <Text className="mt-0.5 text-sm text-slate-600">
            {formatDate(residence.moveInDate)} – {formatDate(residence.moveOutDate)}
          </Text>
          <Text className="mt-0.5 text-sm text-slate-600">
            Landlord: {residence.landlordName || '—'} · {residence.landlordPhone || '—'}
          </Text>
        </View>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            hitSlop={10}
            className="ml-2 p-1"
            accessibilityRole="button"
            accessibilityLabel="Edit residence"
          >
            <Ionicons name="create-outline" size={20} color="#4f46e5" />
          </Pressable>
        ) : null}
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            hitSlop={10}
            className="ml-1 p-1"
            accessibilityRole="button"
            accessibilityLabel="Remove residence"
          >
            <Ionicons name="trash-outline" size={20} color="#dc2626" />
          </Pressable>
        ) : null}
      </View>
      {errors?.map((message) => (
        <Text key={message} className="mt-1 text-sm text-amber-800">
          {message}
        </Text>
      ))}
    </View>
  );
}
