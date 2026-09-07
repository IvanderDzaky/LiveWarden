import type { CollectorResult } from './collector.js';

export type StreamStatus = 'LIVE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN' | 'DISCONNECTED';

export const statusFromResult = (result: CollectorResult): StreamStatus => {
  if (result.collection.successful && result.observation) {
    if (!result.observation.providerLive) return 'OFFLINE';
    return result.observation.degraded ? 'DEGRADED' : 'LIVE';
  }
  return result.error?.code === 'AUTHENTICATION_ERROR' || result.error?.code === 'PROVIDER_UNAVAILABLE'
    ? 'DISCONNECTED'
    : 'UNKNOWN';
};

export const isVerifiedOffline = (result: CollectorResult) =>
  result.collection.successful && result.observation !== null && !result.observation.providerLive;
