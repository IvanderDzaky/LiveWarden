export type StreamStatus = 'LIVE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN' | 'DISCONNECTED';
export type Stream = {
  id: string;
  name: string;
  platform: 'TIKTOK_LIVE';
  identifier: string;
  monitoringEnabled: boolean;
  status: StreamStatus;
  lastCheckedAt: string | null;
  lastSuccessfulAt: string | null;
  lastObservedProviderAt: string | null;
  lastRoomId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ActiveSession = { id: string; streamId: string; startedAt: string; durationSeconds: number | null; peakViewers: number | null; averageViewers: string | null; totalComments: number | null; totalLikeActivity: number | null; totalGifts: number | null; totalGiftQuantity: number | null; totalGiftCoins: number | null; eventCount: number | null; alertCount: number | null };
export type LatestSnapshot = { checkedAt: string; providerOccurredAt: string | null; collectionSucceeded: boolean; statusObserved: StreamStatus; providerRoomId: string | null; currentViewers: number | null; collectorLatencyMs: number | null; errorCode: string | null };
export type StreamAlert = { id: string; streamId: string; liveSessionId: string | null; type: string; severity: 'INFO' | 'WARNING' | 'CRITICAL'; status: 'ACTIVE' | 'ACKNOWLEDGED'; firstDetectedAt: string; lastDetectedAt: string; acknowledgedAt: string | null; description: string; triggerValue: unknown; recommendedAction: string | null };
export type StreamEvent = { eventId: string; schemaVersion: number; type: string; streamId: string; liveSessionId: string | null; source: string; occurredAt: string; receivedAt: string; payload: unknown; metadata: unknown };
export type RecentComment = { username: string; displayName: string; text: string; occurredAt: string };
export type RecentLike = { username: string; displayName: string; count: number; occurredAt: string };
export type RecentGift = { username: string; displayName: string; giftId: number | string; giftName: string; repeatCount: number; giftImageUrl: string | null; occurredAt: string };
export type StreamDetail = { stream: Stream; activeSession: ActiveSession | null; latestSnapshot: LatestSnapshot | null; recentEvents: StreamEvent[]; recentComments: RecentComment[]; recentLikes: RecentLike[]; recentGifts: RecentGift[]; activeAlerts: StreamAlert[] };
export type Session = { id: string; streamId: string; providerRoomId: string | null; startedAt: string; endedAt: string | null; state: string; finalStatus: string | null; durationSeconds: number | null; peakViewers: number | null; averageViewers: string | null; totalComments: number | null; totalLikeActivity: number | null; totalGifts: number | null; totalGiftQuantity: number | null; totalGiftCoins: number | null; eventCount: number | null; alertCount: number | null };

export class StreamApiError extends Error {
  readonly code: string;
  readonly requestId: string;
  constructor(error: { code: string; message: string; requestId: string }) {
    super(error.message);
    this.name = 'StreamApiError';
    this.code = error.code;
    this.requestId = error.requestId;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, credentials: 'include', headers });
  const body = await response.json().catch(() => null) as { data?: T; error?: { code: string; message: string; requestId: string } } | null;
  if (!response.ok || body?.data === undefined) throw new StreamApiError(body?.error ?? { code: 'INTERNAL_ERROR', message: 'Request failed', requestId: '' });
  return body.data;
}

export const listStreams = () => request<{ streams: Stream[] }>('/api/streams');
export const createStream = (input: { name: string; platform: 'TIKTOK_LIVE'; identifier: string }) => request<{ stream: Stream }>('/api/streams', { method: 'POST', body: JSON.stringify(input) });
export const updateStream = (id: string, patch: { name?: string; identifier?: string }) => request<{ stream: Stream }>(`/api/streams/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const setMonitoring = (id: string, enabled: boolean) => request<{ stream: Stream }>(`/api/streams/${id}/monitoring`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
export const deleteStream = (id: string) => request<{ stream: Stream }>(`/api/streams/${id}`, { method: 'DELETE' });
export const getStream = (id: string) => request<StreamDetail>(`/api/streams/${id}`);
export const listStreamSessions = (id: string) => request<{ sessions: Session[] }>(`/api/streams/${id}/sessions?limit=50`);
