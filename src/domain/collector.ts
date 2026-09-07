export type CollectorErrorCode =
  | 'USER_NOT_FOUND'
  | 'STREAM_OFFLINE'
  | 'COLLECTOR_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'AUTHENTICATION_ERROR'
  | 'RATE_LIMITED'
  | 'CONNECTION_ERROR'
  | 'COLLECTOR_ERROR'
  | 'UNKNOWN_COLLECTOR_ERROR';

export type CollectorResult = {
  provider: 'fake' | 'tiktok';
  requestedIdentifier: string;
  canonicalIdentifier: string;
  checkedAt: Date;
  collection: { successful: true; latencyMs: number; providerOccurredAt: Date | null };
  observation: {
    providerLive: boolean;
    degraded: boolean;
    roomId: string | null;
    currentViewers: number | null;
    comments: number;
    likes: number;
    recentComments: { username: string; displayName: string; text: string; occurredAt: Date }[];
    metadata: Record<string, unknown>;
  };
  error: null;
} | {
  provider: 'fake' | 'tiktok';
  requestedIdentifier: string;
  canonicalIdentifier: string;
  checkedAt: Date;
  collection: { successful: false; latencyMs: number; providerOccurredAt: null };
  observation: null;
  error: { code: CollectorErrorCode; retryable: boolean; message: string };
};

export interface Collector {
  readonly provider: 'fake' | 'tiktok';
  collect(identifier: string, options?: { timeoutMs?: number }): Promise<CollectorResult>;
  stop?(identifier: string): Promise<void>;
  close?(): Promise<void>;
  prune?(activeIdentifiers: Set<string>): Promise<void>;
}

export const canonicalIdentifier = (identifier: string) => identifier.trim().replace(/^@/, '');
