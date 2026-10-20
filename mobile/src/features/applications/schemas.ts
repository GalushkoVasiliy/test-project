import { z } from 'zod';

import type { ApplicantInfo, FieldErrors, Residence, SectionStatus } from '@/api/types';
import { isDateOnly, today } from '@/lib/dates';

// Client-side copies of the server's section rules (ApplicationValidators.cs). The server validates again;
// these give immediate feedback, also offline.

/** 7–15 digits with an optional leading +, plus spaces, dots, dashes and parentheses. */
const PHONE_PATTERN = /^(?=(?:\D*\d){7,15}\D*$)\+?[0-9 ().-]{7,25}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const required = (message: string, max: number, maxMessage = `Must be at most ${max} characters.`) =>
  z.string().trim().min(1, message).max(max, maxMessage);

/** Like the server, a format is only checked once there is a value: an empty field is reported as required. */
const matches = (pattern: RegExp) => (value: string) => value === '' || pattern.test(value);

export const applicantInfoSchema = z.object({
  fullName: required('Full name is required.', 100),
  phone: required('Phone is required.', 30).refine(matches(PHONE_PATTERN), 'Enter a valid phone number.'),
  email: required('Email is required.', 256).refine(matches(EMAIL_PATTERN), 'Enter a valid email address.'),
  currentAddress: required('Current address is required.', 200),
});

export type ApplicantInfoForm = z.infer<typeof applicantInfoSchema>;

const dateField = (label: string) =>
  z
    .string()
    .min(1, `${label} date is required.`)
    .refine((value) => value === '' || isDateOnly(value), `${label} date is required.`)
    .refine((value) => value <= today(), `${label} date cannot be in the future.`);

export const residenceSchema = z
  .object({
    id: z.string(),
    address: required('Address is required.', 200),
    landlordName: required('Landlord name is required.', 100),
    landlordPhone: required('Landlord phone is required.', 30).refine(
      matches(PHONE_PATTERN),
      'Enter a valid phone number.',
    ),
    moveInDate: dateField('Move-in'),
    moveOutDate: dateField('Move-out'),
  })
  .refine((r) => !r.moveInDate || !r.moveOutDate || r.moveOutDate > r.moveInDate, {
    message: 'Move-out date must be after the move-in date.',
    path: ['moveOutDate'],
  });

export type ResidenceForm = z.infer<typeof residenceSchema>;

export const MAX_RESIDENCES = 10;

export const residencesSchema = z
  .array(residenceSchema)
  .min(1, 'Add at least one prior residence.')
  .max(MAX_RESIDENCES, `You can list up to ${MAX_RESIDENCES} residences.`);

export const reviewSchema = z
  .object({
    outcome: z.enum(['Approve', 'Return', 'Deny']),
    comment: z.string().trim().max(2000, 'Comment must be at most 2000 characters.'),
    leaseStartDate: z.string(),
  })
  .refine((r) => r.outcome === 'Approve' || r.comment.length > 0, {
    message: 'A comment is required to return or deny an application.',
    path: ['comment'],
  })
  .refine((r) => r.outcome !== 'Approve' || (isDateOnly(r.leaseStartDate) && r.leaseStartDate >= today()), {
    message: 'The lease cannot start in the past.',
    path: ['leaseStartDate'],
  });

export type ReviewForm = z.infer<typeof reviewSchema>;

// ---- Drafts ---------------------------------------------------------------------------------------
// Forms edit plain strings; stored sections use null for anything missing. These helpers convert between
// the two and apply the rules above to stored data, giving the same field-path keyed errors the server
// reports — used to show a draft's errors and the Summary's blocking list immediately, also offline.

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

export function toApplicantInfoForm(
  info: ApplicantInfo | null,
  fallback?: { fullName?: string; email?: string },
): ApplicantInfoForm {
  return {
    fullName: info?.fullName ?? (info ? '' : (fallback?.fullName ?? '')),
    phone: info?.phone ?? '',
    email: info?.email ?? (info ? '' : (fallback?.email ?? '')),
    currentAddress: info?.currentAddress ?? '',
  };
}

export function fromApplicantInfoForm(form: ApplicantInfoForm): ApplicantInfo {
  return {
    fullName: orNull(form.fullName),
    phone: orNull(form.phone),
    email: orNull(form.email),
    currentAddress: orNull(form.currentAddress),
  };
}

export function toResidenceForm(residence: Residence): ResidenceForm {
  return {
    id: residence.id,
    address: residence.address ?? '',
    landlordName: residence.landlordName ?? '',
    landlordPhone: residence.landlordPhone ?? '',
    moveInDate: residence.moveInDate ?? '',
    moveOutDate: residence.moveOutDate ?? '',
  };
}

export function fromResidenceForm(form: ResidenceForm): Residence {
  return {
    id: form.id,
    address: orNull(form.address),
    landlordName: orNull(form.landlordName),
    landlordPhone: orNull(form.landlordPhone),
    moveInDate: orNull(form.moveInDate),
    moveOutDate: orNull(form.moveOutDate),
  };
}

export function applicantInfoIssues(info: ApplicantInfo): FieldErrors {
  return collect(applicantInfoSchema.safeParse(toApplicantInfoForm(info)), 'applicantInfo');
}

/** Keys refer to items by index: keep `residences` in display order (see sortResidences). */
export function residencesIssues(residences: Residence[]): FieldErrors {
  return collect(residencesSchema.safeParse(residences.map(toResidenceForm)), 'residences');
}

export function sectionStatus(isSaved: boolean, errors: FieldErrors): SectionStatus {
  if (!isSaved) return 'Empty';
  return Object.keys(errors).length > 0 ? 'Incomplete' : 'Complete';
}

function collect(result: z.ZodSafeParseResult<unknown>, root: string): FieldErrors {
  if (result.success) {
    return {};
  }

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = root + issue.path.map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`)).join('');
    errors[key] = [...new Set([...(errors[key] ?? []), issue.message])];
  }
  return errors;
}
