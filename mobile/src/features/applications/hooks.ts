import { useMutationState, useQuery } from '@tanstack/react-query';

import { applicationsApi } from '@/api/endpoints';
import type { ApplicationFormResult, ApplicationViewModel } from '@/api/types';
import { queryKeys, scopes } from '@/query/keys';
import {
  mutationKeys,
  type AddApplicantVars,
  type ApplicationFormVars,
  type ApplicationIdVars,
  type CreateApplicationVars,
  type RemoveApplicantVars,
  type ReviewVars,
  type UpdateNotesVars,
  type WithdrawVars,
} from '@/query/mutations';
import { useChange } from '@/query/useChange';

const INLINE_ERRORS = { inlineErrors: true };
const byApplication = (v: { applicationId: string }) => scopes.application(v.applicationId);

/** True while the create request for this (locally started) application has not reached the server. */
function useIsBeingCreated(id: string): boolean {
  return (
    useMutationState({
      filters: {
        mutationKey: mutationKeys.createApplication,
        status: 'pending',
        predicate: (m) => (m.state.variables as CreateApplicationVars | undefined)?.id === id,
      },
      select: (m) => m.mutationId,
    }).length > 0
  );
}

export function useApplication(id: string) {
  const creating = useIsBeingCreated(id);
  return useQuery({
    queryKey: queryKeys.applications.detail(id),
    queryFn: () => applicationsApi.get(id),
    // A draft started on this device is shown from the cache until the server knows about it.
    enabled: !creating,
  });
}

/** Applications started on this device that the server has not confirmed yet. */
export function usePendingApplications(): CreateApplicationVars[] {
  return useMutationState({
    filters: { mutationKey: mutationKeys.createApplication, status: 'pending' },
    select: (m) => m.state.variables as CreateApplicationVars,
  });
}

export const useStartApplication = () =>
  useChange<ApplicationViewModel, CreateApplicationVars>(mutationKeys.createApplication, (v) =>
    scopes.application(v.id),
  );

export const useApplicationForm = () =>
  useChange<ApplicationFormResult, ApplicationFormVars>(mutationKeys.applicationForm, byApplication, INLINE_ERRORS);

export const useAddApplicant = () =>
  useChange<ApplicationViewModel, AddApplicantVars>(mutationKeys.addApplicant, byApplication, INLINE_ERRORS);

export const useRemoveApplicant = () =>
  useChange<void, RemoveApplicantVars>(mutationKeys.removeApplicant, byApplication);

export const useWithdrawApplication = () =>
  useChange<ApplicationViewModel, WithdrawVars>(mutationKeys.withdrawApplication, byApplication);

export const useClaimApplication = () =>
  useChange<ApplicationViewModel, ApplicationIdVars>(mutationKeys.claimApplication, byApplication);

export const useReleaseApplication = () =>
  useChange<ApplicationViewModel, ApplicationIdVars>(mutationKeys.releaseApplication, byApplication);

export const useReviewApplication = () =>
  useChange<ApplicationViewModel, ReviewVars>(mutationKeys.reviewApplication, byApplication, INLINE_ERRORS);

export const useUpdateNotes = () =>
  useChange<ApplicationViewModel, UpdateNotesVars>(mutationKeys.updateNotes, byApplication, INLINE_ERRORS);
