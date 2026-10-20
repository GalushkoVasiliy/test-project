// Mirrors the backend DTOs (see backend/src/Rentals.Api/Features/**/…Models.cs and /swagger).

export type UserRole = 'Applicant' | 'PropertyManager';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AccessTokenResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

/** ISO date without time, e.g. "2026-10-20". */
export type DateOnly = string;

export interface UnitType {
  id: number;
  name: string;
  isActive: boolean;
}

export interface Lease {
  id: string;
  applicationId: string;
  startDate: DateOnly;
  endDate: DateOnly;
}

export interface PropertySummary {
  id: string;
  name: string;
  address: string;
  city: string;
  unitCount: number;
  availableUnitCount: number;
  version: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  bedrooms: number;
  monthlyRent: number;
  unitTypeId: number;
  unitTypeName: string;
  unitTypeIsActive: boolean;
  isAvailable: boolean;
  currentLease: Lease | null;
  openApplicationCount: number;
  version: string;
}

export interface PropertyDetails {
  id: string;
  name: string;
  address: string;
  city: string;
  version: string;
  units: Unit[];
}

export interface AvailableUnit {
  id: string;
  propertyId: string;
  propertyName: string;
  propertyAddress: string;
  city: string;
  unitNumber: string;
  bedrooms: number;
  monthlyRent: number;
  unitTypeName: string;
}

export interface PropertyInput {
  name: string;
  address: string;
  city: string;
}

export interface UnitInput {
  unitNumber: string;
  bedrooms: number;
  monthlyRent: number;
  unitTypeId: number;
}

export const APPLICATION_STATUSES = [
  'Draft',
  'Submitted',
  'UnderReview',
  'Returned',
  'Approved',
  'Denied',
  'Withdrawn',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type ReviewOutcome = 'Approve' | 'Return' | 'Deny';

export type ApplicationSection = 'ApplicantInfo' | 'Residences';

export type ApplicationStep = ApplicationSection | 'Summary';

export type SortDirection = 'Asc' | 'Desc';

export type ApplicationSortField =
  'UpdatedAt' | 'CreatedAt' | 'SubmittedAt' | 'Status' | 'Property' | 'Applicant' | 'Rent';

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ApplicationListItem {
  id: string;
  status: ApplicationStatus;
  unitId: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  monthlyRent: number;
  applicantName: string;
  coApplicantCount: number;
  reviewerName: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

/** As stored. Values may be missing while the section is a draft. */
export interface ApplicantInfo {
  fullName: string | null;
  phone: string | null;
  email: string | null;
  currentAddress: string | null;
}

/** As stored. Values may be missing while the section is a draft. */
export interface Residence {
  id: string;
  address: string | null;
  landlordName: string | null;
  landlordPhone: string | null;
  moveInDate: DateOnly | null;
  moveOutDate: DateOnly | null;
}

/** Empty: never saved. Incomplete: saved as a draft that still has errors. Complete: passes every rule. */
export type SectionStatus = 'Empty' | 'Incomplete' | 'Complete';

/** Errors keyed by field path, e.g. "applicantInfo.phone" or "residences[0].moveOutDate". */
export type FieldErrors = Record<string, string[]>;

export interface SectionState<T> {
  data: T;
  isSaved: boolean;
  version: number;
  status: SectionStatus;
  errors: FieldErrors;
}

export interface ApplicantSummary {
  id: string;
  fullName: string;
  email: string | null;
  isPrimary: boolean;
  /** Evaluated for the current user. */
  canRemove: boolean;
}

export interface Person {
  id: string;
  fullName: string;
  email: string | null;
}

export interface ApplicationPermissions {
  canEdit: boolean;
  canSubmit: boolean;
  canWithdraw: boolean;
  canClaim: boolean;
  canRelease: boolean;
  canReview: boolean;
  canEditNotes: boolean;
  canManageApplicants: boolean;
}

export interface StatusChange {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  outcome: ReviewOutcome | null;
  comment: string | null;
  changedByName: string;
  changedAt: string;
}

/** The single view model behind the application page. Editability is decided by the server. */
export interface ApplicationViewModel {
  id: string;
  status: ApplicationStatus;
  unit: {
    id: string;
    unitNumber: string;
    bedrooms: number;
    monthlyRent: number;
    unitTypeName: string;
    propertyId: string;
    propertyName: string;
    propertyAddress: string;
    city: string;
  };
  /** The primary applicant. */
  applicant: Person;
  /** Everyone on the application, primary applicant first. */
  applicants: ApplicantSummary[];
  isEditable: boolean;
  permissions: ApplicationPermissions;
  sections: {
    applicantInfo: SectionState<ApplicantInfo | null>;
    /** Residence errors refer to items by their index in `data`. */
    residences: SectionState<Residence[]>;
  };
  lease: Lease | null;
  reviewer: Person | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  latestDecision: { outcome: ReviewOutcome; comment: string | null; decidedAt: string } | null;
  /** Property managers only. */
  history?: StatusChange[];
  /** Property managers only. */
  managerNotes?: { text: string | null; version: number };
}

export interface ApplicationFormResult {
  application: ApplicationViewModel;
  nextStep: ApplicationStep;
}
