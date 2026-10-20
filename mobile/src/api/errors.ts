import type { ProblemDetails } from './types';

/** The server answered with an error status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly problem: ProblemDetails | null,
  ) {
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}.`);
    this.name = 'ApiError';
  }

  get code(): string | undefined {
    return this.problem?.code;
  }

  get fieldErrors(): Record<string, string[]> {
    return this.problem?.errors ?? {};
  }

  get isValidation(): boolean {
    return this.status === 400 && Object.keys(this.fieldErrors).length > 0;
  }

  /**
   * The server understood the request and refused it (validation, conflict, permissions…).
   * Retrying the same request will not help, so a queued change that ends here is reported as rejected.
   */
  get isRejection(): boolean {
    return this.status >= 400 && this.status < 500 && ![401, 408, 429].includes(this.status);
  }
}

/** The server could not be reached. Requests that fail this way are worth retrying. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Could not reach the server.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError || error instanceof NetworkError) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}
