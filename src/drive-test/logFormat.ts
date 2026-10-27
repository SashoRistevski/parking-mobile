import type { DetectionEvent, DetectionState } from '../detection/machine';

export type LogSampleFields = {
  at: number;
  state: DetectionState;
  speedKmh: number | null;
  accuracyM: number | null;
  stepCount: number | null;
  cadence: number | null;
  zoneCode: string | null;
  paidNow: boolean;
  ambiguous: boolean;
  openSession: boolean;
  event: DetectionEvent;
};

function formatEvent(event: DetectionEvent): string {
  if (event.type === 'remind') {
    return `remind:${event.zoneCode}`;
  }
  return 'none';
}

function formatOptionalNumber(value: number | null): string {
  if (value === null) {
    return '-';
  }
  return String(Math.round(value));
}

export function formatSampleLogLine(fields: LogSampleFields): string {
  const time = new Date(fields.at).toISOString();
  return [
    time,
    fields.state,
    `spd=${formatOptionalNumber(fields.speedKmh)}`,
    `acc=${formatOptionalNumber(fields.accuracyM)}`,
    `steps=${fields.stepCount ?? '-'}`,
    `cad=${fields.cadence !== null ? String(Math.round(fields.cadence)) : '-'}`,
    `zone=${fields.zoneCode ?? '-'}`,
    `paid=${fields.paidNow}`,
    `amb=${fields.ambiguous}`,
    `open=${fields.openSession}`,
    `event=${formatEvent(fields.event)}`,
  ].join(' ');
}

export function formatStateChangeLine(
  at: number,
  from: DetectionState,
  to: DetectionState,
): string {
  const time = new Date(at).toISOString();
  return `${time} STATE ${from} -> ${to}`;
}
