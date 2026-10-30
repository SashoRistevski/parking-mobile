import type { CandidateZone } from './sessions';
import type { ApiErrorBody } from './types';

type ApiErrorPayload = ApiErrorBody & {
  candidates?: CandidateZone[];
};

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string[]>;
  readonly candidates?: CandidateZone[];

  constructor(status: number, body: ApiErrorPayload) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = body.errors;
    if (Array.isArray(body.candidates)) {
      this.candidates = body.candidates;
    }
  }
}

export function fieldErrorMessage(
  error: ApiError,
  field: string,
): string | undefined {
  const messages = error.errors?.[field];
  return messages?.[0];
}

export function displayErrorMessage(error: unknown, field?: string): string {
  if (error instanceof ApiError) {
    if (field) {
      const fieldMessage = fieldErrorMessage(error, field);
      if (fieldMessage) {
        return fieldMessage;
      }
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong.';
}
