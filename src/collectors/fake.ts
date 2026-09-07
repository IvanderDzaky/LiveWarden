import type { Collector, CollectorErrorCode, CollectorResult } from '../domain/collector.js';
import { canonicalIdentifier } from '../domain/collector.js';

export type FakeResult = Omit<CollectorResult, 'checkedAt'> | (() => Omit<CollectorResult, 'checkedAt'> | Promise<Omit<CollectorResult, 'checkedAt'>>);

export class FakeCollector implements Collector {
  readonly provider = 'fake' as const;
  private readonly sequences = new Map<string, FakeResult[]>();

  constructor(results: Record<string, FakeResult | FakeResult[]> = {}) {
    for (const [identifier, result] of Object.entries(results)) {
      this.sequences.set(canonicalIdentifier(identifier), Array.isArray(result) ? [...result] : [result]);
    }
  }

  async collect(identifier: string): Promise<CollectorResult> {
    const key = canonicalIdentifier(identifier);
    const sequence = this.sequences.get(key);
    const next = sequence?.length ? sequence.shift()! : {
      provider: 'fake' as const,
      requestedIdentifier: identifier,
      canonicalIdentifier: key,
      collection: { successful: true as const, latencyMs: 0, providerOccurredAt: null },
      observation: { providerLive: false, degraded: false, roomId: null, currentViewers: null, comments: 0, likes: 0, recentComments: [], metadata: {} },
      error: null
    };
    const result = typeof next === 'function' ? await next() : next;
    return { ...result, checkedAt: new Date() } as CollectorResult;
  }
}

export const fakeSuccess = (providerLive: boolean, options: Partial<{ degraded: boolean; roomId: string; currentViewers: number; comments: number; likes: number; recentComments: { username: string; displayName: string; text: string; occurredAt: Date }[] }> = {}) => ({
  provider: 'fake' as const,
  requestedIdentifier: '',
  canonicalIdentifier: '',
  collection: { successful: true as const, latencyMs: 1, providerOccurredAt: null },
  observation: { providerLive, degraded: options.degraded ?? false, roomId: options.roomId ?? null, currentViewers: options.currentViewers ?? null, comments: options.comments ?? options.recentComments?.length ?? 0, likes: options.likes ?? 0, recentComments: options.recentComments ?? [], metadata: {} },
  error: null
});

export const fakeFailure = (code: CollectorErrorCode, retryable = false) => ({
  provider: 'fake' as const,
  requestedIdentifier: '',
  canonicalIdentifier: '',
  collection: { successful: false as const, latencyMs: 1, providerOccurredAt: null },
  observation: null,
  error: { code, retryable, message: String(code) }
});
