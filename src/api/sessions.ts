import { apiRequest } from './client';

export type ParkingSessionZoneOperator =
  | string
  | null
  | {
      short_name: string;
      name: string;
    };

export type ParkingSessionZone = {
  id: number;
  code: string | null;
  name: string;
  operator: ParkingSessionZoneOperator;
};

export type CandidateZone = {
  id: number;
  code: string | null;
  name: string;
  display_name: string | null;
  operator: ParkingSessionZoneOperator;
};

export type ParkingSession = {
  id: number;
  status: string;
  payment_model: string;
  payment_method: string;
  confirmation_status: string;
  started_at: string | null;
  paid_until: string | null;
  paid_until_local: string | null;
  purchased_hours: number | null;
  vehicle_id: number;
  zone: ParkingSessionZone | null;
};

export type SmsPayload = {
  supported: boolean;
  recipient: string | null;
  body: string | null;
  reason: string | null;
} | null;

export type SessionResult = {
  data: ParkingSession;
  sms: SmsPayload;
};

export type StartSessionInput = {
  vehicle_id: number;
  lat: number;
  lng: number;
  accuracy_m?: number;
  zone_id?: number;
  hours?: number;
};

export type StartSessionOptions = {
  idempotencyKey?: string;
};

export type ConfirmSessionStatus = 'confirmed' | 'failed';

export type StopSessionInput = {
  already_sent?: boolean;
};

export type ListSessionsQuery = {
  vehicle_id?: number;
  from?: string;
  to?: string;
  page?: number;
};

export type SessionListMeta = {
  current_page: number;
  last_page: number;
};

export type SessionListResult = {
  data: ParkingSession[];
  meta?: SessionListMeta;
};

type SessionResultResponse = SessionResult;

type ActiveSessionsResponse = {
  data: ParkingSession[];
};

type SessionListResponse = {
  data: ParkingSession[];
  meta?: SessionListMeta;
};

function sessionPath(suffix = ''): string {
  return `/sessions${suffix}`;
}

function buildListQuery(query?: ListSessionsQuery): string {
  if (!query) {
    return '';
  }
  const params = new URLSearchParams();
  if (query.vehicle_id !== undefined) {
    params.set('vehicle_id', String(query.vehicle_id));
  }
  if (query.from !== undefined) {
    params.set('from', query.from);
  }
  if (query.to !== undefined) {
    params.set('to', query.to);
  }
  if (query.page !== undefined) {
    params.set('page', String(query.page));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function startSession(
  body: StartSessionInput,
  options?: StartSessionOptions,
): Promise<SessionResult> {
  return apiRequest<SessionResultResponse>(sessionPath(), {
    method: 'POST',
    body,
    auth: true,
    idempotencyKey: options?.idempotencyKey,
  });
}

export async function markSent(id: number): Promise<SessionResult> {
  return apiRequest<SessionResultResponse>(sessionPath(`/${id}/sent`), {
    method: 'POST',
    auth: true,
  });
}

export async function markCancelled(id: number): Promise<SessionResult> {
  return apiRequest<SessionResultResponse>(sessionPath(`/${id}/cancelled`), {
    method: 'POST',
    auth: true,
  });
}

export async function confirmSession(
  id: number,
  status: ConfirmSessionStatus,
): Promise<SessionResult> {
  return apiRequest<SessionResultResponse>(sessionPath(`/${id}/confirmation`), {
    method: 'POST',
    body: { status },
    auth: true,
  });
}

export async function extendSession(
  id: number,
  hours: number,
): Promise<SessionResult> {
  return apiRequest<SessionResultResponse>(sessionPath(`/${id}/extend`), {
    method: 'POST',
    body: { hours },
    auth: true,
  });
}

export async function stopSession(
  id: number,
  body?: StopSessionInput,
): Promise<SessionResult> {
  return apiRequest<SessionResultResponse>(sessionPath(`/${id}/stop`), {
    method: 'POST',
    body: body ?? undefined,
    auth: true,
  });
}

export async function getActiveSessions(): Promise<ParkingSession[]> {
  const response = await apiRequest<ActiveSessionsResponse>(
    sessionPath('/active'),
    {
      method: 'GET',
      auth: true,
    },
  );
  return response.data;
}

export async function listSessions(
  query?: ListSessionsQuery,
): Promise<SessionListResult> {
  const response = await apiRequest<SessionListResponse>(
    `${sessionPath()}${buildListQuery(query)}`,
    {
      method: 'GET',
      auth: true,
    },
  );
  return {
    data: response.data,
    meta: response.meta,
  };
}
