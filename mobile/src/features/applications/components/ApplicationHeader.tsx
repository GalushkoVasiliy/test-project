import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import type { ApplicationStep, ApplicationViewModel } from '@/api/types';
import { Badge, Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';
import { bedroomsLabel, formatDate, formatDateTime, formatRent } from '@/lib/format';

import { StatusBadge } from './StatusBadge';

export function ApplicationHeader({
  vm,
  syncing,
  showApplicant,
}: {
  vm: ApplicationViewModel;
  syncing: boolean;
  showApplicant: boolean;
}) {
  return (
    <Card>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="text-lg font-semibold text-slate-900">
            {vm.unit.propertyName} · Unit {vm.unit.unitNumber}
          </Text>
          <Text className="mt-0.5 text-sm text-slate-500">
            {vm.unit.propertyAddress}, {vm.unit.city}
          </Text>
          <Text className="mt-1 text-sm text-slate-700">
            {bedroomsLabel(vm.unit.bedrooms)} · {vm.unit.unitTypeName} · {formatRent(vm.unit.monthlyRent)}
          </Text>
        </View>
        <View className="items-end">
          <StatusBadge status={vm.status} />
          {syncing ? (
            <View className="mt-1">
              <Badge label="Waiting to sync" tone="amber" />
            </View>
          ) : null}
        </View>
      </View>

      {showApplicant ? (
        <View className="mt-3 border-t border-slate-100 pt-3">
          <Text className="text-sm text-slate-700">
            Applicant: <Text className="font-semibold">{vm.applicant.fullName}</Text>
            {vm.applicant.email ? ` · ${vm.applicant.email}` : ''}
          </Text>
          {vm.submittedAt ? (
            <Text className="mt-0.5 text-xs text-slate-500">Submitted {formatDateTime(vm.submittedAt)}</Text>
          ) : null}
          {vm.reviewer ? (
            <Text className="mt-0.5 text-xs text-slate-500">Being reviewed by {vm.reviewer.fullName}</Text>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

/** Tells the applicant (and manager) the outcome of the latest review. */
export function DecisionNotice({ vm }: { vm: ApplicationViewModel }) {
  const decision = vm.latestDecision;

  if (vm.status === 'Approved') {
    return (
      <Notice tone="green" icon="checkmark-circle" title="Approved">
        {vm.lease
          ? `Twelve-month lease from ${formatDate(vm.lease.startDate)} to ${formatDate(vm.lease.endDate)}.`
          : 'A lease has been issued.'}
      </Notice>
    );
  }
  if (vm.status === 'Returned' && decision) {
    return (
      <Notice tone="amber" icon="arrow-undo" title="Returned for changes">
        {decision.comment ?? 'Please review your application and submit it again.'}
      </Notice>
    );
  }
  if (vm.status === 'Denied' && decision) {
    return (
      <Notice tone="red" icon="close-circle" title="Denied">
        {decision.comment ?? 'This application was denied.'}
      </Notice>
    );
  }
  return null;
}

const noticeTones = {
  green: { box: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-900', icon: '#059669' },
  amber: { box: 'bg-amber-50 border-amber-200', text: 'text-amber-900', icon: '#d97706' },
  red: { box: 'bg-red-50 border-red-200', text: 'text-red-900', icon: '#dc2626' },
} as const;

function Notice({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof noticeTones;
  icon: 'checkmark-circle' | 'arrow-undo' | 'close-circle';
  title: string;
  children: string;
}) {
  const style = noticeTones[tone];
  return (
    <View className={cn('mb-3 flex-row rounded-2xl border p-4', style.box)}>
      <Ionicons name={icon} size={20} color={style.icon} />
      <View className="ml-3 flex-1">
        <Text className={cn('font-semibold', style.text)}>{title}</Text>
        <Text className={cn('mt-0.5 text-sm', style.text)}>{children}</Text>
      </View>
    </View>
  );
}

const STEPS: { step: ApplicationStep; label: string }[] = [
  { step: 'ApplicantInfo', label: 'Applicant' },
  { step: 'Residences', label: 'Residences' },
  { step: 'Summary', label: 'Summary' },
];

export function StepIndicator({ step, vm }: { step: ApplicationStep; vm: ApplicationViewModel }) {
  const saved: Record<ApplicationStep, boolean> = {
    ApplicantInfo: vm.sections.applicantInfo.status === 'Complete',
    Residences: vm.sections.residences.status === 'Complete',
    Summary: false,
  };

  return (
    <View className="mb-3 flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
      {STEPS.map((s, index) => {
        const current = s.step === step;
        return (
          <View key={s.step} className="flex-1 flex-row items-center justify-center">
            <View
              className={cn(
                'h-6 w-6 items-center justify-center rounded-full',
                current ? 'bg-brand-600' : saved[s.step] ? 'bg-emerald-500' : 'bg-slate-200',
              )}
            >
              {saved[s.step] && !current ? (
                <Ionicons name="checkmark" size={14} color="#ffffff" />
              ) : (
                <Text className={cn('text-xs font-bold', current ? 'text-white' : 'text-slate-600')}>{index + 1}</Text>
              )}
            </View>
            <Text className={cn('ml-1.5 text-xs font-medium', current ? 'text-brand-700' : 'text-slate-500')}>
              {s.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
