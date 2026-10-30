import { apiRequest } from './client';

export type LocateZone = {
  id: number;
  code: string | null;
  name: string;
  display_name: string | null;
  operator: string | null;
};

export type LocateResponse = {
  inside_zone: boolean;
  zone: LocateZone | null;
  ambiguous: boolean;
  paid_now: boolean;
};

export type LocateInput = {
  lat: number;
  lng: number;
  accuracy_m: number | null;
};

export async function postLocate(input: LocateInput): Promise<LocateResponse> {
  return apiRequest<LocateResponse>('/locate', {
    method: 'POST',
    auth: true,
    body: input,
  });
}
