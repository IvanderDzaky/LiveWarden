import type { CollectorErrorCode } from '../domain/collector.js';

export type ClassifiedTikTokError = {
  code: CollectorErrorCode;
  retryable: boolean;
  message: string;
};

const safeMessage = (error: unknown) => {
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error).slice(0, 500);
};

export const classifyTikTokError = (error: unknown): ClassifiedTikTokError => {
  const name = error instanceof Error ? error.name : '';
  const message = safeMessage(error).toLowerCase();
  if (name === 'UserOfflineError') return { code: 'STREAM_OFFLINE', retryable: false, message: 'provider verified stream offline' };
  if (name === 'ConnectTimeoutError' || message.includes('timeout')) return { code: 'COLLECTOR_TIMEOUT', retryable: true, message: 'tiktok connection timeout' };
  if (name === 'SignatureRateLimitError' || message.includes('rate limit')) return { code: 'RATE_LIMITED', retryable: false, message: 'tiktok rate limited' };
  if (name === 'AuthenticatedWebSocketConnectionError' || name === 'SignatureMissingTokensError') return { code: 'AUTHENTICATION_ERROR', retryable: false, message: 'tiktok authentication unavailable' };
  if (name === 'SignAPIError' || message.includes('sign service')) return { code: 'PROVIDER_UNAVAILABLE', retryable: true, message: 'tiktok provider unavailable' };
  if (/network|socket|dns|econn|websocket|connect/i.test(message)) return { code: 'NETWORK_ERROR', retryable: true, message: 'tiktok network failure' };
  if (/failed to retrieve room id|user.*not found|invalid.*user/i.test(message)) return { code: 'USER_NOT_FOUND', retryable: false, message: 'tiktok user could not be verified' };
  return { code: 'UNKNOWN_COLLECTOR_ERROR', retryable: false, message: `tiktok collector failure: ${safeMessage(error)}` };
};
