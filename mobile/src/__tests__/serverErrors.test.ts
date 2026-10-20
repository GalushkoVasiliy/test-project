import { ApiError } from '@/api/errors';
import { applyServerErrors } from '@/lib/serverErrors';

const validation = (errors: Record<string, string[]>) =>
  new ApiError(400, { title: 'One or more validation errors occurred.', errors, code: 'validation_failed' });

describe('applyServerErrors', () => {
  it('puts each server message on its field, stripping the section prefix', () => {
    const setError = jest.fn();
    const unmatched = applyServerErrors(
      validation({
        'applicantInfo.email': ['Enter a valid email address.'],
        'applicantInfo.phone': ['Enter a valid phone number.'],
      }),
      setError,
      ['email', 'phone', 'fullName'] as const,
      'applicantInfo.',
    );

    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Enter a valid email address.' });
    expect(setError).toHaveBeenCalledWith('phone', { type: 'server', message: 'Enter a valid phone number.' });
    expect(unmatched).toEqual([]);
  });

  it('returns conflicts and unknown keys so the screen can show them', () => {
    const unmatched = applyServerErrors(
      new ApiError(409, {
        title: 'Conflict',
        detail: 'This unit already has an active lease.',
        code: 'unit_has_active_lease',
      }),
      jest.fn(),
      ['comment'] as const,
    );
    expect(unmatched).toEqual(['This unit already has an active lease.']);
  });
});

describe('ApiError', () => {
  it('treats 4xx responses (except auth/timeouts) as rejections that must not be retried', () => {
    expect(new ApiError(409, null).isRejection).toBe(true);
    expect(new ApiError(400, null).isRejection).toBe(true);
    expect(new ApiError(401, null).isRejection).toBe(false);
    expect(new ApiError(503, null).isRejection).toBe(false);
  });
});
