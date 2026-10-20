import type { MutationKey, QueryClient, QueryKey } from '@tanstack/react-query';

import { applicationsApi, propertiesApi, unitsApi, type SaveCommand } from '@/api/endpoints';
import type {
  ApplicantInfo,
  ApplicationFormResult,
  ApplicationPermissions,
  ApplicationSection,
  ApplicationStatus,
  ApplicationViewModel,
  AvailableUnit,
  DateOnly,
  PropertyDetails,
  PropertyInput,
  PropertySummary,
  Residence,
  ReviewOutcome,
  Unit,
  UnitInput,
} from '@/api/types';
import { applicantInfoIssues, residencesIssues, sectionStatus } from '@/features/applications/schemas';
import { useSessionStore } from '@/stores/session';
import { resolveVersion, useSyncStore } from '@/stores/sync';

import { queryKeys, scopes } from './keys';

/*
 * Every mutation is registered here with setMutationDefaults rather than inline in a component.
 * A mutation made offline is persisted with the query cache and may be replayed after an app restart,
 * when no component is around: only defaults registered up front can supply its mutationFn and
 * cache updates at that point. Components just name the mutation key and a scope.
 */

export const mutationKeys = {
  createProperty: ['properties', 'create'],
  updateProperty: ['properties', 'update'],
  deleteProperty: ['properties', 'delete'],
  createUnit: ['units', 'create'],
  updateUnit: ['units', 'update'],
  deleteUnit: ['units', 'delete'],
  createApplication: ['applications', 'create'],
  applicationForm: ['applications', 'form'],
  addApplicant: ['applications', 'applicants', 'add'],
  removeApplicant: ['applications', 'applicants', 'remove'],
  withdrawApplication: ['applications', 'withdraw'],
  claimApplication: ['applications', 'claim'],
  releaseApplication: ['applications', 'release'],
  reviewApplication: ['applications', 'review'],
  updateNotes: ['applications', 'notes'],
} as const satisfies Record<string, MutationKey>;

export interface CreatePropertyVars {
  id: string;
  input: PropertyInput;
}
export interface UpdatePropertyVars {
  id: string;
  input: PropertyInput;
  baseVersion: string;
}
export interface DeletePropertyVars {
  id: string;
  name: string;
}
export interface CreateUnitVars {
  propertyId: string;
  id: string;
  input: UnitInput;
  unitTypeName: string;
}
export interface UpdateUnitVars extends CreateUnitVars {
  baseVersion: string;
}
export interface DeleteUnitVars {
  propertyId: string;
  id: string;
  unitNumber: string;
}
export interface CreateApplicationVars {
  id: string;
  unit: AvailableUnit;
}
export type ApplicationFormVars =
  | {
      applicationId: string;
      command: SaveCommand;
      section: 'ApplicantInfo';
      baseVersion: number;
      applicantInfo: ApplicantInfo;
    }
  | { applicationId: string; command: SaveCommand; section: 'Residences'; baseVersion: number; residences: Residence[] }
  | { applicationId: string; command: 'Submit' };
export interface AddApplicantVars {
  applicationId: string;
  email: string;
}
export interface RemoveApplicantVars {
  applicationId: string;
  applicantId: string;
  name: string;
  leaving: boolean;
}
export interface WithdrawVars {
  applicationId: string;
  reason?: string;
}
export interface ApplicationIdVars {
  applicationId: string;
}
export interface ReviewVars {
  applicationId: string;
  outcome: ReviewOutcome;
  comment?: string;
  leaseStartDate?: DateOnly;
}
export interface UpdateNotesVars {
  applicationId: string;
  text: string;
  baseVersion: number;
}

const sectionKey = { ApplicantInfo: 'applicantInfo', Residences: 'residences' } as const satisfies Record<
  ApplicationSection,
  string
>;

const sectionTitle: Record<ApplicationSection, string> = {
  ApplicantInfo: 'Applicant Information',
  Residences: 'Residence History',
};

/** Human-readable name of a change, used when telling the user that a queued change was rejected. */
export function describeMutation(key: MutationKey | undefined, variables: unknown): string {
  const v = variables as Record<string, any>;
  switch (key?.join('.')) {
    case 'properties.create':
      return `Add property “${v.input.name}”`;
    case 'properties.update':
      return `Update property “${v.input.name}”`;
    case 'properties.delete':
      return `Remove property “${v.name}”`;
    case 'units.create':
      return `Add unit ${v.input.unitNumber}`;
    case 'units.update':
      return `Update unit ${v.input.unitNumber}`;
    case 'units.delete':
      return `Remove unit ${v.unitNumber}`;
    case 'applications.create':
      return `Start application for unit ${v.unit.unitNumber}`;
    case 'applications.form':
      if (v.command === 'Submit') return 'Submit application';
      return `${v.command === 'SaveDraft' ? 'Save draft of' : 'Save'} “${sectionTitle[v.section as ApplicationSection]}”`;
    case 'applications.applicants.add':
      return `Add ${v.email} to the application`;
    case 'applications.applicants.remove':
      return v.leaving ? 'Leave the application' : `Remove ${v.name} from the application`;
    case 'applications.withdraw':
      return 'Withdraw application';
    case 'applications.claim':
      return 'Claim application for review';
    case 'applications.release':
      return 'Release application';
    case 'applications.review':
      return `${v.outcome} application`;
    case 'applications.notes':
      return 'Save manager notes';
    default:
      return 'Change';
  }
}

export function registerMutationDefaults(client: QueryClient) {
  // ---- Properties & units -------------------------------------------------------------------

  client.setMutationDefaults<PropertyDetails, Error, CreatePropertyVars>(mutationKeys.createProperty, {
    mutationFn: ({ id, input }: CreatePropertyVars) => propertiesApi.create(id, input),
    onMutate: ({ id, input }: CreatePropertyVars) => {
      client.setQueryData<PropertySummary[]>(
        queryKeys.properties.list(),
        (list) => list && [...list, { id, ...input, unitCount: 0, availableUnitCount: 0, version: '' }].sort(byName),
      );
      client.setQueryData<PropertyDetails>(queryKeys.properties.detail(id), { id, ...input, version: '', units: [] });
    },
    onSuccess: (data: PropertyDetails, { id }: CreatePropertyVars) => {
      if (!othersPending(client, scopes.property(id).id)) {
        client.setQueryData(queryKeys.properties.detail(id), data);
      }
    },
    onSettled: (_d: unknown, _e: unknown, { id }: CreatePropertyVars) =>
      settle(client, scopes.property(id).id, [queryKeys.properties.all]),
  });

  client.setMutationDefaults<PropertyDetails, Error, UpdatePropertyVars>(mutationKeys.updateProperty, {
    mutationFn: async ({ id, input, baseVersion }: UpdatePropertyVars) => {
      const key = `property:${id}`;
      const version = resolveVersion(key, baseVersion);
      const result = await propertiesApi.update(id, input, version);
      useSyncStore.getState().recordVersion(key, version, result.version);
      return result;
    },
    onMutate: ({ id, input }: UpdatePropertyVars) => {
      client.setQueryData<PropertySummary[]>(queryKeys.properties.list(), (list) =>
        list?.map((p) => (p.id === id ? { ...p, ...input } : p)),
      );
      client.setQueryData<PropertyDetails>(queryKeys.properties.detail(id), (p) => p && { ...p, ...input });
    },
    onSuccess: (data: PropertyDetails, { id }: UpdatePropertyVars) => {
      if (!othersPending(client, scopes.property(id).id)) {
        client.setQueryData(queryKeys.properties.detail(id), data);
      }
    },
    onSettled: (_d: unknown, _e: unknown, { id }: UpdatePropertyVars) =>
      settle(client, scopes.property(id).id, [queryKeys.properties.all]),
  });

  client.setMutationDefaults<void, Error, DeletePropertyVars>(mutationKeys.deleteProperty, {
    mutationFn: ({ id }: DeletePropertyVars) => propertiesApi.remove(id),
    onMutate: ({ id }: DeletePropertyVars) => {
      client.setQueryData<PropertySummary[]>(queryKeys.properties.list(), (list) => list?.filter((p) => p.id !== id));
    },
    onSuccess: (_d: unknown, { id }: DeletePropertyVars) => {
      client.removeQueries({ queryKey: queryKeys.properties.detail(id) });
    },
    onSettled: (_d: unknown, _e: unknown, { id }: DeletePropertyVars) =>
      settle(client, scopes.property(id).id, [
        queryKeys.properties.all,
        queryKeys.units.all,
        queryKeys.applications.all,
      ]),
  });

  client.setMutationDefaults<Unit, Error, CreateUnitVars>(mutationKeys.createUnit, {
    mutationFn: ({ propertyId, id, input }: CreateUnitVars) => unitsApi.create(propertyId, id, input),
    onMutate: ({ propertyId, id, input, unitTypeName }: CreateUnitVars) => {
      const unit: Unit = {
        id,
        propertyId,
        ...input,
        unitTypeName,
        unitTypeIsActive: true,
        isAvailable: true,
        currentLease: null,
        openApplicationCount: 0,
        version: '',
      };
      updateUnits(client, propertyId, (units) => [...units, unit].sort(byUnitNumber));
      client.setQueryData<PropertySummary[]>(queryKeys.properties.list(), (list) =>
        list?.map((p) =>
          p.id === propertyId ? { ...p, unitCount: p.unitCount + 1, availableUnitCount: p.availableUnitCount + 1 } : p,
        ),
      );
    },
    onSuccess: (data: Unit, { propertyId }: CreateUnitVars) => {
      if (!othersPending(client, scopes.property(propertyId).id)) {
        updateUnits(client, propertyId, (units) => units.map((u) => (u.id === data.id ? data : u)));
      }
    },
    onSettled: (_d: unknown, _e: unknown, { propertyId }: CreateUnitVars) =>
      settle(client, scopes.property(propertyId).id, [queryKeys.properties.all, queryKeys.units.all]),
  });

  client.setMutationDefaults<Unit, Error, UpdateUnitVars>(mutationKeys.updateUnit, {
    mutationFn: async ({ id, input, baseVersion }: UpdateUnitVars) => {
      const key = `unit:${id}`;
      const version = resolveVersion(key, baseVersion);
      const result = await unitsApi.update(id, input, version);
      useSyncStore.getState().recordVersion(key, version, result.version);
      return result;
    },
    onMutate: ({ propertyId, id, input, unitTypeName }: UpdateUnitVars) => {
      updateUnits(client, propertyId, (units) =>
        units.map((u) => (u.id === id ? { ...u, ...input, unitTypeName } : u)).sort(byUnitNumber),
      );
    },
    onSuccess: (data: Unit, { propertyId }: UpdateUnitVars) => {
      if (!othersPending(client, scopes.property(propertyId).id)) {
        updateUnits(client, propertyId, (units) => units.map((u) => (u.id === data.id ? data : u)));
      }
    },
    onSettled: (_d: unknown, _e: unknown, { propertyId }: UpdateUnitVars) =>
      settle(client, scopes.property(propertyId).id, [
        queryKeys.properties.all,
        queryKeys.units.all,
        queryKeys.applications.all,
      ]),
  });

  client.setMutationDefaults<void, Error, DeleteUnitVars>(mutationKeys.deleteUnit, {
    mutationFn: ({ id }: DeleteUnitVars) => unitsApi.remove(id),
    onMutate: ({ propertyId, id }: DeleteUnitVars) => {
      updateUnits(client, propertyId, (units) => units.filter((u) => u.id !== id));
    },
    onSettled: (_d: unknown, _e: unknown, { propertyId }: DeleteUnitVars) =>
      settle(client, scopes.property(propertyId).id, [queryKeys.properties.all, queryKeys.units.all]),
  });

  // ---- Applications -------------------------------------------------------------------------

  client.setMutationDefaults<ApplicationViewModel, Error, CreateApplicationVars>(mutationKeys.createApplication, {
    mutationFn: ({ id, unit }: CreateApplicationVars) => applicationsApi.create(id, unit.id),
    onMutate: ({ id, unit }: CreateApplicationVars) => {
      client.setQueryData(queryKeys.applications.detail(id), draftViewModel(id, unit));
    },
    onSuccess: (data: ApplicationViewModel, { id }: CreateApplicationVars) => {
      if (!othersPending(client, scopes.application(id).id)) {
        client.setQueryData(queryKeys.applications.detail(id), data);
      }
    },
    onSettled: (_d: unknown, _e: unknown, { id }: CreateApplicationVars) =>
      settle(client, scopes.application(id).id, [queryKeys.applications.all]),
  });

  client.setMutationDefaults<ApplicationFormResult, Error, ApplicationFormVars>(mutationKeys.applicationForm, {
    mutationFn: async (vars: ApplicationFormVars) => {
      if (vars.command === 'Submit') {
        return applicationsApi.form(vars.applicationId, { command: 'Submit' });
      }

      const key = `application:${vars.applicationId}:${vars.section}`;
      const version = Number(resolveVersion(key, vars.baseVersion));
      const result = await applicationsApi.form(
        vars.applicationId,
        vars.section === 'ApplicantInfo'
          ? { command: vars.command, section: 'ApplicantInfo', version, applicantInfo: vars.applicantInfo }
          : { command: vars.command, section: 'Residences', version, residences: vars.residences },
      );
      useSyncStore
        .getState()
        .recordVersion(key, version, result.application.sections[sectionKey[vars.section]].version);
      return result;
    },
    onMutate: (vars: ApplicationFormVars) => {
      updateApplication(client, vars.applicationId, (vm) => {
        if (vars.command === 'Submit') {
          return withStatus(vm, 'Submitted', { submittedAt: new Date().toISOString() });
        }

        // Same rules as the server, so a draft's errors (and whether it can be submitted) show right away.
        let sections = vm.sections;
        if (vars.section === 'ApplicantInfo') {
          const errors = applicantInfoIssues(vars.applicantInfo);
          sections = {
            ...sections,
            applicantInfo: {
              ...sections.applicantInfo,
              data: vars.applicantInfo,
              isSaved: true,
              errors,
              status: sectionStatus(true, errors),
            },
          };
        } else {
          const data = sortResidences(vars.residences);
          const errors = residencesIssues(data);
          sections = {
            ...sections,
            residences: { ...sections.residences, data, isSaved: true, errors, status: sectionStatus(true, errors) },
          };
        }
        const complete = sections.applicantInfo.status === 'Complete' && sections.residences.status === 'Complete';
        return { ...vm, sections, permissions: { ...vm.permissions, canSubmit: vm.isEditable && complete } };
      });
    },
    onSuccess: (data: ApplicationFormResult, vars: ApplicationFormVars) => {
      if (!othersPending(client, scopes.application(vars.applicationId).id)) {
        client.setQueryData(queryKeys.applications.detail(vars.applicationId), data.application);
      }
    },
    onSettled: (_d: unknown, _e: unknown, vars: ApplicationFormVars) =>
      settle(client, scopes.application(vars.applicationId).id, [queryKeys.applications.all]),
  });

  registerTransition<AddApplicantVars>(
    client,
    mutationKeys.addApplicant,
    ({ applicationId, email }) => applicationsApi.addApplicant(applicationId, email),
    (vm, { email }) =>
      vm.applicants.some((a) => a.email?.toLowerCase() === email.toLowerCase())
        ? vm
        : {
            ...vm,
            applicants: [
              ...vm.applicants,
              { id: `pending:${email}`, fullName: email, email, isPrimary: false, canRemove: false },
            ],
          },
  );

  client.setMutationDefaults<void, Error, RemoveApplicantVars>(mutationKeys.removeApplicant, {
    mutationFn: ({ applicationId, applicantId }) => applicationsApi.removeApplicant(applicationId, applicantId),
    onMutate: ({ applicationId, applicantId }) =>
      updateApplication(client, applicationId, (vm) => ({
        ...vm,
        applicants: vm.applicants.filter((a) => a.id !== applicantId),
      })),
    onSuccess: (_d, { applicationId, leaving }) => {
      if (leaving) {
        // The application is no longer visible to this user.
        client.removeQueries({ queryKey: queryKeys.applications.detail(applicationId) });
      }
    },
    onSettled: (_d, _e, { applicationId, leaving }) =>
      settle(
        client,
        scopes.application(applicationId).id,
        leaving ? [queryKeys.applications.lists()] : [queryKeys.applications.all],
      ),
  });

  registerTransition<WithdrawVars>(
    client,
    mutationKeys.withdrawApplication,
    ({ applicationId, reason }) => applicationsApi.withdraw(applicationId, reason),
    (vm) => withStatus(vm, 'Withdrawn'),
  );

  registerTransition<ApplicationIdVars>(
    client,
    mutationKeys.claimApplication,
    ({ applicationId }) => applicationsApi.claim(applicationId),
    (vm) => {
      const user = useSessionStore.getState().user;
      return withStatus(vm, 'UnderReview', { reviewer: user && { id: user.id, fullName: user.fullName, email: null } });
    },
  );

  registerTransition<ApplicationIdVars>(
    client,
    mutationKeys.releaseApplication,
    ({ applicationId }) => applicationsApi.release(applicationId),
    (vm) => withStatus(vm, 'Submitted', { reviewer: null }),
  );

  registerTransition<ReviewVars>(
    client,
    mutationKeys.reviewApplication,
    ({ applicationId, outcome, comment, leaseStartDate }) =>
      applicationsApi.review(applicationId, { outcome, comment, leaseStartDate }),
    (vm, { outcome, comment }) =>
      withStatus(vm, outcomeStatus[outcome], {
        reviewer: null,
        decidedAt: new Date().toISOString(),
        latestDecision: { outcome, comment: comment ?? null, decidedAt: new Date().toISOString() },
      }),
  );

  client.setMutationDefaults<ApplicationViewModel, Error, UpdateNotesVars>(mutationKeys.updateNotes, {
    mutationFn: async ({ applicationId, text, baseVersion }: UpdateNotesVars) => {
      const key = `application:${applicationId}:notes`;
      const version = Number(resolveVersion(key, baseVersion));
      const result = await applicationsApi.updateNotes(applicationId, text, version);
      useSyncStore.getState().recordVersion(key, version, result.managerNotes?.version ?? version);
      return result;
    },
    onMutate: ({ applicationId, text }: UpdateNotesVars) => {
      updateApplication(client, applicationId, (vm) => ({
        ...vm,
        managerNotes: { text, version: vm.managerNotes?.version ?? 0 },
      }));
    },
    onSuccess: (data: ApplicationViewModel, { applicationId }: UpdateNotesVars) => {
      if (!othersPending(client, scopes.application(applicationId).id)) {
        client.setQueryData(queryKeys.applications.detail(applicationId), data);
      }
    },
    onSettled: (_d: unknown, _e: unknown, { applicationId }: UpdateNotesVars) =>
      settle(client, scopes.application(applicationId).id, [queryKeys.applications.detail(applicationId)]),
  });
}

/** Status transitions share the same shape: optimistic status change, then the server's view model. */
function registerTransition<TVars extends { applicationId: string }>(
  client: QueryClient,
  key: MutationKey,
  mutationFn: (vars: TVars) => Promise<ApplicationViewModel>,
  optimistic: (vm: ApplicationViewModel, vars: TVars) => ApplicationViewModel,
) {
  client.setMutationDefaults<ApplicationViewModel, Error, TVars>(key, {
    mutationFn,
    onMutate: (vars: TVars) => updateApplication(client, vars.applicationId, (vm) => optimistic(vm, vars)),
    onSuccess: (data: ApplicationViewModel, vars: TVars) => {
      if (!othersPending(client, scopes.application(vars.applicationId).id)) {
        client.setQueryData(queryKeys.applications.detail(vars.applicationId), data);
      }
    },
    onSettled: (_d: unknown, _e: unknown, vars: TVars) =>
      settle(client, scopes.application(vars.applicationId).id, [queryKeys.applications.all, queryKeys.units.all]),
  });
}

const outcomeStatus: Record<ReviewOutcome, ApplicationStatus> = {
  Approve: 'Approved',
  Return: 'Returned',
  Deny: 'Denied',
};

/** Best guess of what the server will return after a status change, until it actually does. */
function withStatus(
  vm: ApplicationViewModel,
  status: ApplicationStatus,
  patch: Partial<ApplicationViewModel> = {},
): ApplicationViewModel {
  const user = useSessionStore.getState().user;
  const isManager = user?.role === 'PropertyManager';
  const isOwner = vm.applicants.some((a) => a.id === user?.id);
  const editable = isOwner && (status === 'Draft' || status === 'Returned');
  const reviewer = patch.reviewer !== undefined ? patch.reviewer : vm.reviewer;
  const isReviewer = isManager && status === 'UnderReview' && reviewer?.id === user?.id;

  const permissions: ApplicationPermissions = {
    canEdit: editable,
    canSubmit:
      editable && vm.sections.applicantInfo.status === 'Complete' && vm.sections.residences.status === 'Complete',
    canWithdraw: isOwner && ['Draft', 'Submitted', 'UnderReview', 'Returned'].includes(status),
    canClaim: isManager && status === 'Submitted',
    canRelease: isReviewer,
    canReview: isReviewer,
    canEditNotes: isManager,
    canManageApplicants: editable,
  };

  return { ...vm, ...patch, status, isEditable: editable, permissions, updatedAt: new Date().toISOString() };
}

function draftViewModel(id: string, unit: AvailableUnit): ApplicationViewModel {
  const user = useSessionStore.getState().user;
  const now = new Date().toISOString();
  return {
    id,
    status: 'Draft',
    unit: {
      id: unit.id,
      unitNumber: unit.unitNumber,
      bedrooms: unit.bedrooms,
      monthlyRent: unit.monthlyRent,
      unitTypeName: unit.unitTypeName,
      propertyId: unit.propertyId,
      propertyName: unit.propertyName,
      propertyAddress: unit.propertyAddress,
      city: unit.city,
    },
    applicant: { id: user?.id ?? '', fullName: user?.fullName ?? '', email: user?.email ?? null },
    applicants: [
      {
        id: user?.id ?? '',
        fullName: user?.fullName ?? '',
        email: user?.email ?? null,
        isPrimary: true,
        canRemove: false,
      },
    ],
    isEditable: true,
    permissions: {
      canEdit: true,
      canSubmit: false,
      canWithdraw: true,
      canClaim: false,
      canRelease: false,
      canReview: false,
      canEditNotes: false,
      canManageApplicants: true,
    },
    sections: {
      applicantInfo: { data: null, isSaved: false, version: 0, status: 'Empty', errors: {} },
      residences: { data: [], isSaved: false, version: 0, status: 'Empty', errors: {} },
    },
    lease: null,
    reviewer: null,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    decidedAt: null,
    latestDecision: null,
  };
}

function updateApplication(
  client: QueryClient,
  id: string,
  update: (vm: ApplicationViewModel) => ApplicationViewModel,
) {
  client.setQueryData<ApplicationViewModel>(queryKeys.applications.detail(id), (vm) => vm && update(vm));
}

function updateUnits(client: QueryClient, propertyId: string, update: (units: Unit[]) => Unit[]) {
  client.setQueryData<PropertyDetails>(
    queryKeys.properties.detail(propertyId),
    (p) => p && { ...p, units: update(p.units) },
  );
}

/** True when other changes to the same record are still waiting — their optimistic state must not be overwritten. */
function othersPending(client: QueryClient, scopeId: string): boolean {
  return (
    client.getMutationCache().findAll({ status: 'pending', predicate: (m) => m.options.scope?.id === scopeId }).length >
    1
  );
}

/**
 * Refetch from the server once the last queued change to a record has settled. Not awaited: the change
 * is done once the server confirmed it, and screens should not wait for lists to reload.
 */
function settle(client: QueryClient, scopeId: string, keys: QueryKey[]) {
  if (othersPending(client, scopeId)) {
    return;
  }
  for (const queryKey of keys) {
    void client.invalidateQueries({ queryKey });
  }
}

/** Same order as the server (most recent move-out first, undated last), which residence errors refer to. */
export function sortResidences(residences: Residence[]): Residence[] {
  return [...residences].sort((a, b) => {
    if (a.moveOutDate !== b.moveOutDate) {
      if (!a.moveOutDate) return 1;
      if (!b.moveOutDate) return -1;
      return a.moveOutDate < b.moveOutDate ? 1 : -1;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
const byUnitNumber = (a: Unit, b: Unit) => a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true });
