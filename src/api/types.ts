export type ApiErrorBody = {
  message: string;
  errors?: Record<string, string[]>;
};

export type User = {
  id: number;
  username: string;
  email: string;
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
