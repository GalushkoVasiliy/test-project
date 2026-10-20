import {
  applicantInfoIssues,
  applicantInfoSchema,
  residenceSchema,
  residencesIssues,
  residencesSchema,
  reviewSchema,
  sectionStatus,
} from '@/features/applications/schemas';
import { today } from '@/lib/dates';

const residence = {
  id: 'r1',
  address: '9 Elm St',
  landlordName: 'Pat Landlord',
  landlordPhone: '(555) 765-4321',
  moveInDate: '2022-01-01',
  moveOutDate: '2024-06-30',
};

describe('application section rules (mirroring the server)', () => {
  it('accepts common phone formats and rejects junk', () => {
    const info = { fullName: 'Alex', email: 'alex@example.com', currentAddress: '1 Main St' };
    expect(applicantInfoSchema.safeParse({ ...info, phone: '(555) 123-4567' }).success).toBe(true);
    expect(applicantInfoSchema.safeParse({ ...info, phone: '+1 555 123 4567' }).success).toBe(true);
    expect(applicantInfoSchema.safeParse({ ...info, phone: '12345' }).success).toBe(false);
  });

  it('requires move-out to be after move-in', () => {
    const result = residenceSchema.safeParse({ ...residence, moveOutDate: '2021-12-31' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['moveOutDate']);
  });

  it('rejects dates in the future', () => {
    expect(residenceSchema.safeParse({ ...residence, moveOutDate: '2999-01-01' }).success).toBe(false);
  });

  it('requires at least one residence', () => {
    expect(residencesSchema.safeParse([]).success).toBe(false);
    expect(residencesSchema.safeParse([residence]).success).toBe(true);
  });

  it('requires a comment to return or deny, and a lease start that is not in the past', () => {
    expect(reviewSchema.safeParse({ outcome: 'Deny', comment: '', leaseStartDate: '' }).success).toBe(false);
    expect(reviewSchema.safeParse({ outcome: 'Return', comment: 'Fix phone', leaseStartDate: '' }).success).toBe(true);
    expect(reviewSchema.safeParse({ outcome: 'Approve', comment: '', leaseStartDate: today() }).success).toBe(true);
    expect(reviewSchema.safeParse({ outcome: 'Approve', comment: '', leaseStartDate: '2000-01-01' }).success).toBe(
      false,
    );
  });
});

describe('draft sections', () => {
  it('reports applicant info errors with the same field paths as the server', () => {
    const errors = applicantInfoIssues({ fullName: 'Alex', phone: '12', email: null, currentAddress: null });
    expect(Object.keys(errors).sort()).toEqual([
      'applicantInfo.currentAddress',
      'applicantInfo.email',
      'applicantInfo.phone',
    ]);
    expect(sectionStatus(true, errors)).toBe('Incomplete');
  });

  it('keys residence errors by item index, and an empty list by the list itself', () => {
    expect(residencesIssues([])).toEqual({ residences: ['Add at least one prior residence.'] });

    const errors = residencesIssues([
      {
        id: 'a',
        address: '1 Main St',
        landlordName: null,
        landlordPhone: '(555) 765-4321',
        moveInDate: '2022-01-01',
        moveOutDate: '2023-01-01',
      },
    ]);
    expect(errors['residences[0].landlordName']).toEqual(['Landlord name is required.']);
  });

  it('treats a never-saved section as empty and a valid one as complete', () => {
    expect(sectionStatus(false, {})).toBe('Empty');
    expect(sectionStatus(true, {})).toBe('Complete');
  });
});

it('reports an empty field once, as required — like the server', () => {
  const errors = applicantInfoIssues({ fullName: 'Alex', phone: null, email: null, currentAddress: '1 Main St' });
  expect(errors['applicantInfo.phone']).toEqual(['Phone is required.']);
  expect(errors['applicantInfo.email']).toEqual(['Email is required.']);
});
