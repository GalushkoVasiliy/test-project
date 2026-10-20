import { useState } from 'react';

import type { ApplicationStep, ApplicationViewModel } from '@/api/types';
import { Screen } from '@/components/Screen';
import { ErrorState, PendingState } from '@/components/ui/StateViews';
import { scopes } from '@/query/keys';
import { useIsSyncing } from '@/query/useChange';
import { useIsManager } from '@/stores/session';

import { ApplicantsCard } from './components/ApplicantsCard';
import { ApplicationHeader, DecisionNotice, StepIndicator } from './components/ApplicationHeader';
import { ManagerPanel } from './components/ManagerPanel';
import { useApplication } from './hooks';
import { ApplicantInfoSection } from './sections/ApplicantInfoSection';
import { ResidencesSection } from './sections/ResidencesSection';
import { SummarySection } from './sections/SummarySection';

/** Editable drafts open at the first unsaved section; everything else opens at the Summary. */
function initialStep(vm: ApplicationViewModel): ApplicationStep {
  if (!vm.isEditable) return 'Summary';
  if (!vm.sections.applicantInfo.isSaved) return 'ApplicantInfo';
  if (!vm.sections.residences.isSaved) return 'Residences';
  return 'Summary';
}

/**
 * The application page: one view model from the server drives it, and one section is shown at a time.
 * Each section component renders editable or read-only according to the server's decision.
 */
export function ApplicationScreen({ id }: { id: string }) {
  const application = useApplication(id);
  const isManager = useIsManager();
  const syncing = useIsSyncing(scopes.application(id));
  const [step, setStep] = useState<ApplicationStep | null>(null);

  if (!application.data) {
    return application.isError ? (
      <ErrorState error={application.error} onRetry={() => application.refetch()} />
    ) : (
      <PendingState paused={application.fetchStatus === 'paused'} />
    );
  }

  const vm = application.data;
  const current = step ?? initialStep(vm);
  const props = { vm, onNavigate: setStep };

  return (
    <Screen scroll refreshing={application.isRefetching} onRefresh={() => application.refetch()}>
      <ApplicationHeader vm={vm} syncing={syncing} showApplicant={isManager} />
      <DecisionNotice vm={vm} />
      <ApplicantsCard vm={vm} />
      <StepIndicator step={current} vm={vm} />

      {/* Keyed by version: when the section is saved (here or by a co-applicant) the form reloads from the server. */}
      {current === 'ApplicantInfo' ? (
        <ApplicantInfoSection key={`info-${vm.isEditable}-${vm.sections.applicantInfo.version}`} {...props} />
      ) : null}
      {current === 'Residences' ? (
        <ResidencesSection key={`residences-${vm.isEditable}-${vm.sections.residences.version}`} {...props} />
      ) : null}
      {current === 'Summary' ? <SummarySection {...props} /> : null}

      {isManager ? <ManagerPanel vm={vm} /> : null}
    </Screen>
  );
}
