import type { Stream, StreamStatus } from './streams';
import { statusLabel } from '../presentation';

export type DashboardAlert = {
  id: string;
  streamId: string;
  liveSessionId: string | null;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'ACTIVE' | 'ACKNOWLEDGED';
  firstDetectedAt: string;
  lastDetectedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  description: string;
  triggerValue: unknown;
  recommendedAction: string | null;
};

export type DashboardEvent = {
  eventId: string;
  schemaVersion: number;
  type: string;
  streamId: string;
  liveSessionId: string | null;
  source: string;
  occurredAt: string;
  receivedAt: string;
  payload: unknown;
  metadata: unknown;
};

export type DashboardOverview = {
  kpis: { monitoredStreams: number; liveStreams: number; problemStreams: number; activeAlerts: number };
  streams: Array<Stream & { latestViewers: number | null; latestSnapshotAt: string | null; activeSession: { id: string; startedAt: string; peakViewers: number | null; averageViewers: string | null } | null }>;
  activeAlerts: DashboardAlert[];
  recentEvents: DashboardEvent[];
};

export class DashboardApiError extends Error {
  readonly code: string;
  readonly requestId: string;
  constructor(error: { code: string; message: string; requestId: string }) { super(error.message); this.name = 'DashboardApiError'; this.code = error.code; this.requestId = error.requestId; }
}

export const getDashboardOverview = async (): Promise<DashboardOverview> => {
  const response = await fetch('/api/dashboard/overview', { credentials: 'include' });
  const body = await response.json().catch(() => null) as { data?: DashboardOverview; error?: { code: string; message: string; requestId: string } } | null;
  if (!response.ok || body?.data === undefined) throw new DashboardApiError(body?.error ?? { code: 'INTERNAL_ERROR', message: 'Request failed', requestId: '' });
  return body.data;
};

export { statusLabel };
