import type { CollectorErrorCode } from '../domain/collector.js';

export type ClassifiedTikTokError = {
  code: CollectorErrorCode;
  retryable: boolean;
  message: string;
};

const unwrap = (error: unknown): unknown => {
  if (!error || typeof error !== 'object') return error;
  const value = error as { exception?: unknown; error?: unknown };
  return value.exception ?? value.error ?? error;
};

const safeMessage = (error: unknown) => {
  const value = unwrap(error);
  if (value instanceof Error) return value.message.slice(0, 500);
  if (value && typeof value === 'object' && 'message' in value) return String((value as { message?: unknown }).message).slice(0, 500);
  return String(value).slice(0, 500);
};

export const classifyTikTokError = (error: unknown): ClassifiedTikTokError => {
  const cause = unwrap(error);
  const name = cause instanceof Error ? cause.name : cause && typeof cause === 'object' && 'name' in cause ? String((cause as { name?: unknown }).name) : '';
  const message = safeMessage(error).toLowerCase();
  if (name === 'UserOfflineError') return { code: 'STREAM_OFFLINE', retryable: false, message: 'provider verified stream offline' };
  if (name === 'ConnectTimeoutError' || message.includes('timeout')) return { code: 'COLLECTOR_TIMEOUT', retryable: true, message: `tiktok connection timeout: ${safeMessage(error)}` };
  if (name === 'SignatureRateLimitError' || message.includes('rate limit')) return { code: 'RATE_LIMITED', retryable: false, message: 'tiktok rate limited' };
  if (message.includes('unexpected server response: 200')) return { code: 'PROVIDER_UNAVAILABLE', retryable: true, message: 'Euler Stream fallback WebSocket returned HTTP 200 instead of websocket 101; upgrade connector/provider or contact Euler Stream' };
  if (name === 'AuthenticatedWebSocketConnectionError' || name === 'SignatureMissingTokensError') return { code: 'AUTHENTICATION_ERROR', retryable: false, message: 'tiktok authentication unavailable' };
  if (name === 'SignAPIError' || message.includes('sign service')) return { code: 'PROVIDER_UNAVAILABLE', retryable: true, message: `tiktok provider unavailable: ${safeMessage(error)}` };
  if (/network|socket|dns|econn|websocket|connect/i.test(message)) return { code: 'NETWORK_ERROR', retryable: true, message: `tiktok network failure: ${safeMessage(error)}` };
  if (/failed to retrieve room id|user.*not found|invalid.*user/i.test(message)) return { code: 'USER_NOT_FOUND', retryable: false, message: 'tiktok user could not be verified' };
  return { code: 'UNKNOWN_COLLECTOR_ERROR', retryable: false, message: `tiktok collector failure: ${safeMessage(error)}` };
};
