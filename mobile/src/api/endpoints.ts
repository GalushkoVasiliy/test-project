import { api } from './client';
import type {
  AccessTokenResponse,
  ApplicantInfo,
  ApplicationFormResult,
  ApplicationListItem,
  ApplicationSortField,
  ApplicationStatus,
  ApplicationViewModel,
  AvailableUnit,
  CurrentUser,
  DateOnly,
  PagedResult,
  PropertyDetails,
  PropertyInput,
  PropertySummary,
  Residence,
  ReviewOutcome,
  SortDirection,
  Unit,
  UnitInput,
  UnitType,
  UserRole,
} from './types';

export const authApi = {
  login: (email: string, password: string) =>
    api<AccessTokenResponse>('/api/auth/login', { method: 'POST', body: { email, password }, auth: false }),

  register: (input: { email: string; password: string; fullName: string; role: UserRole }) =>
    api<AccessTokenResponse>('/api/auth/register', { method: 'POST', body: input, auth: false }),

  me: (token?: string) => api<CurrentUser>('/api/auth/me', { token }),
};

export const lookupsApi = {
  unitTypes: () => api<UnitType[]>('/api/lookups/unit-types'),
};

export const propertiesApi = {
  list: () => api<PropertySummary[]>('/api/properties'),

  get: (id: string) => api<PropertyDetails>(`/api/properties/${id}`),

  create: (id: string, input: PropertyInput) =>
    api<PropertyDetails>('/api/properties', { method: 'POST', body: { id, ...input } }),

  update: (id: string, input: PropertyInput, version: string) =>
    api<PropertyDetails>(`/api/properties/${id}`, { method: 'PUT', body: { ...input, version } }),

  remove: (id: string) => api<void>(`/api/properties/${id}`, { method: 'DELETE' }),
};

export const unitsApi = {
  available: (filters: { propertyId?: string | null; minBedrooms?: number | null }) =>
    api<AvailableUnit[]>('/api/units/available', { query: filters }),

  create: (propertyId: string, id: string, input: UnitInput) =>
    api<Unit>(`/api/properties/${propertyId}/units`, { method: 'POST', body: { id, ...input } }),

  update: (id: string, input: UnitInput, version: string) =>
    api<Unit>(`/api/units/${id}`, { method: 'PUT', body: { ...input, version } }),

  remove: (id: string) => api<void>(`/api/units/${id}`, { method: 'DELETE' }),
};

export interface ApplicationListParams {
  status?: ApplicationStatus | null;
  propertyId?: string | null;
  page: number;
  pageSize: number;
  sortBy: ApplicationSortField;
  sortDir: SortDirection;
}

/** Continue saves only a valid section; SaveDraft saves it as it is; Submit submits. */
export type SaveCommand = 'Continue' | 'SaveDraft';

export type ApplicationFormBody =
  | { command: SaveCommand; section: 'ApplicantInfo'; version: number; applicantInfo: ApplicantInfo }
  | { command: SaveCommand; section: 'Residences'; version: number; residences: Residence[] }
  | { command: 'Submit' };

export const applicationsApi = {
  list: (params: ApplicationListParams, signal?: AbortSignal) =>
    api<PagedResult<ApplicationListItem>>('/api/applications', { query: { ...params }, signal }),

  get: (id: string) => api<ApplicationViewModel>(`/api/applications/${id}`),

  create: (id: string, unitId: string) =>
    api<ApplicationViewModel>('/api/applications', { method: 'POST', body: { id, unitId } }),

  /** The form's single action: the command says which button was pressed. */
  form: (id: string, body: ApplicationFormBody) =>
    api<ApplicationFormResult>(`/api/applications/${id}/form`, { method: 'POST', body }),

  addApplicant: (id: string, email: string) =>
    api<ApplicationViewModel>(`/api/applications/${id}/applicants`, { method: 'POST', body: { email } }),

  removeApplicant: (id: string, applicantId: string) =>
    api<void>(`/api/applications/${id}/applicants/${encodeURIComponent(applicantId)}`, { method: 'DELETE' }),

  withdraw: (id: string, reason?: string) =>
    api<ApplicationViewModel>(`/api/applications/${id}/withdraw`, { method: 'POST', body: { reason } }),

  claim: (id: string) => api<ApplicationViewModel>(`/api/applications/${id}/claim`, { method: 'POST' }),

  release: (id: string) => api<ApplicationViewModel>(`/api/applications/${id}/release`, { method: 'POST' }),

  review: (id: string, body: { outcome: ReviewOutcome; comment?: string; leaseStartDate?: DateOnly }) =>
    api<ApplicationViewModel>(`/api/applications/${id}/review`, { method: 'POST', body }),

  updateNotes: (id: string, text: string, version: number) =>
    api<ApplicationViewModel>(`/api/applications/${id}/notes`, { method: 'PUT', body: { text, version } }),
};
