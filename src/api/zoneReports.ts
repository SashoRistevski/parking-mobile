import { apiRequest } from './client';

export type CreateZoneReportInput = {
  lat: number;
  lng: number;
  accuracy_m?: number;
  detected_zone_id?: number;
  reported_zone_code: string;
  reason: string;
  note?: string;
};

export async function createZoneReport(
  body: CreateZoneReportInput,
): Promise<unknown> {
  return apiRequest('/zone-reports', {
    method: 'POST',
    body,
    auth: true,
  });
}
