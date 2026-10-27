import { randomUUID } from 'expo-crypto';

import { ApiError } from './errors';
import type { ApiErrorBody } from './types';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

type ApiClientConfig = {
  getToken: () => string | null;
  onUnauthorized: () => void;
};

let clientConfig: ApiClientConfig | null = null;

export function configureApiClient(config: ApiClientConfig): void {
  clientConfig = config;
}

function getBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_URL is not set');
  }
  return baseUrl.replace(/\/$/, '');
}

function newIdempotencyKey(): string {
  return randomUUID();
}

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  auth?: boolean;
  idempotencyKey?: string;
};

export type ApiRequestMetaResult<T> = {
  status: number;
  etag: string | null;
  body: T | null;
};

export async function apiRequestMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiRequestMetaResult<T>> {
  if (!clientConfig) {
    throw new Error('API client is not configured');
  }

  const method = (options.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (MUTATING_METHODS.has(method)) {
    headers['Idempotency-Key'] = options.idempotencyKey ?? newIdempotencyKey();
  }

  const useAuth = options.auth === true;
  if (useAuth) {
    const token = clientConfig.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const etag = response.headers.get('ETag');

  if (response.status === 304) {
    return { status: 304, etag, body: null };
  }

  if (response.status === 204) {
    return { status: 204, etag, body: null };
  }

  const text = await response.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (response.status === 401 && useAuth && clientConfig.getToken()) {
    clientConfig.onUnauthorized();
  }

  if (!response.ok) {
    const body = (json ?? { message: response.statusText }) as ApiErrorBody;
    throw new ApiError(response.status, body);
  }

  return { status: response.status, etag, body: json as T };
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!clientConfig) {
    throw new Error('API client is not configured');
  }

  const method = (options.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (MUTATING_METHODS.has(method)) {
    headers['Idempotency-Key'] = options.idempotencyKey ?? newIdempotencyKey();
  }

  const useAuth = options.auth === true;
  if (useAuth) {
    const token = clientConfig.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (response.status === 401 && useAuth && clientConfig.getToken()) {
    clientConfig.onUnauthorized();
  }

  if (!response.ok) {
    const body = (json ?? { message: response.statusText }) as ApiErrorBody;
    throw new ApiError(response.status, body);
  }

  return json as T;
}
