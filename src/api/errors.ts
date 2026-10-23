import type { ApiErrorBody } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly errors?: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = body.errors;
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
