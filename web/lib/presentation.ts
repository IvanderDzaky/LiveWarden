import type { StreamStatus } from './api/streams';

export const statusLabel: Record<StreamStatus, string> = { LIVE: 'Live', OFFLINE: 'Offline', DEGRADED: 'Degraded', UNKNOWN: 'Unknown', DISCONNECTED: 'Disconnected' };
export const statusDescription = (status: StreamStatus) => status === 'UNKNOWN' ? 'Status could not be determined.' : status === 'OFFLINE' ? 'Provider confirmed stream is offline.' : status === 'LIVE' ? 'Provider confirmed stream is live.' : status === 'DEGRADED' ? 'Stream is live with a monitoring degradation.' : 'Provider connection is unavailable.';
export const isStale = (value: string | null, thresholdMs = 120_000) => !value || Date.now() - Date.parse(value) > thresholdMs;
