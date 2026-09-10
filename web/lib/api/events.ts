export type EventLogItem = {
  eventId: string;
  schemaVersion: number;
  type: string;
  streamId: string;
  streamName?: string;
  streamIdentifier?: string;
  liveSessionId: string | null;
  source: string;
  occurredAt: string;
  receivedAt: string;
  payload: unknown;
  metadata: unknown;
};

export class EventApiError extends Error {
  readonly code: string;
  readonly requestId: string;
  constructor(error: { code: string; message: string; requestId: string }) {
    super(error.message);
    this.name = 'EventApiError';
    this.code = error.code;
    this.requestId = error.requestId;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, credentials: 'include', headers });
  const body = (await response.json().catch(() => null)) as { data?: T; error?: { code: string; message: string; requestId: string } } | null;
  if (!response.ok || body?.data === undefined) {
    throw new EventApiError(body?.error ?? { code: 'INTERNAL_ERROR', message: 'Request failed', requestId: '' });
  }
  return body.data;
}

export const listEvents = (filters: { streamId?: string; type?: string; limit?: number } = {}) => {
  const params = new URLSearchParams({ limit: String(filters.limit ?? 50) });
  if (filters.streamId) params.set('streamId', filters.streamId);
  if (filters.type) params.set('type', filters.type);
  return request<{ events: EventLogItem[] }>(`/api/events?${params}`);
};
