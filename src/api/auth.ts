import { apiRequest } from './client';
import type {
  AuthTokenResponse,
  MeResponse,
  MessageResponse,
} from './types';

export const DEVICE_NAME = 'parking-mobile';

export async function login(
  email: string,
  password: string,
): Promise<AuthTokenResponse> {
  return apiRequest<AuthTokenResponse>('/auth/login', {
    method: 'POST',
    body: { email, password, device_name: DEVICE_NAME },
    auth: false,
  });
}

export async function register(
  username: string,
  email: string,
  password: string,
): Promise<AuthTokenResponse> {
  return apiRequest<AuthTokenResponse>('/auth/register', {
    method: 'POST',
    body: {
      username,
      email,
      password,
      terms: 'accepted',
      device_name: DEVICE_NAME,
    },
    auth: false,
  });
}

export async function forgotPassword(email: string): Promise<MessageResponse> {
  return apiRequest<MessageResponse>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    auth: false,
  });
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', {
    method: 'POST',
    auth: true,
  });
}

export async function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me', {
    method: 'GET',
    auth: true,
  });
}
