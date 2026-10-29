export type ApiErrorBody = {
  message: string;
  errors?: Record<string, string[]>;
};

export type User = {
  id: number;
  username: string;
  email: string;
  email_verified_at: string | null;
  created_at: string;
};

export type MeResponse = {
  data: User;
};

export type AuthTokenResponse = {
  accessToken: string;
};

export type MessageResponse = {
  message: string;
};
