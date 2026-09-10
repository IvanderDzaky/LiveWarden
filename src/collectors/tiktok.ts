import { ControlEvent, TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';
import type { AudienceGift, AudienceLike, Collector, CollectorResult } from '../domain/collector.js';
import { canonicalIdentifier } from '../domain/collector.js';
import { classifyTikTokError } from './tiktok-errors.js';

type ProviderConnection = {
  connect(): Promise<{ roomId?: string; roomInfo?: unknown }>;
  disconnect(): Promise<void>;
  on(event: string, listener: (...args: any[]) => void): unknown;
  removeAllListeners?(): unknown;
};

export type TikTokConnectionFactory = (identifier: string, options: Record<string, unknown>) => ProviderConnection;
type ConnectionEntry = { connection: ProviderConnection; roomId: string | null; viewers: number | null; comments: number; likes: number; recentComments: { username: string; displayName: string; text: string; occurredAt: Date }[]; recentLikes: AudienceLike[]; recentGifts: AudienceGift[]; commentKeys: Set<string>; connected: boolean; initialized: boolean; reconnectAttempt: number; reconnectTimer?: NodeJS.Timeout; stableTimer?: NodeJS.Timeout; connecting?: Promise<void>; providerOccurredAt: Date | null };

const defaultFactory: TikTokConnectionFactory = (identifier, options) =>
  new TikTokLiveConnection(identifier, options as ConstructorParameters<typeof TikTokLiveConnection>[1]) as unknown as ProviderConnection;

const providerTimestamp = (value: unknown) => {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  const date = new Date(number < 10_000_000_000 ? number * 1000 : number);
  return Number.isNaN(date.getTime()) ? null : date;
};

const viewerCount = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) { const parsed = Number(value); return Number.isSafeInteger(parsed) ? parsed : null; }
  return null;
};

const roomInfoViewers = (value: unknown): number | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of ['userCount', 'user_count', 'viewerCount', 'viewer_count', 'totalUser', 'total_user']) {
    const count = viewerCount(record[key]);
    if (count !== null) return count;
  }
  for (const key of ['data', 'room', 'roomInfo', 'stats']) {
    const count = roomInfoViewers(record[key]);
    if (count !== null) return count;
  }
  return null;
};
const boundedText = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const positiveInteger = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
const giftImageUrl = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const urls = (value as { url?: unknown }).url;
  return Array.isArray(urls) ? boundedText(urls[0], 2_000) || null : boundedText(urls, 2_000) || null;
};

export class TikTokCollector implements Collector {
  readonly provider = 'tiktok' as const;
  private readonly factory: TikTokConnectionFactory;
  private readonly observationWindowMs: number;
  private readonly requestTimeoutMs: number;
  private readonly handshakeTimeoutMs: number;
  private readonly signApiKey?: string;
  private readonly connections = new Map<string, ConnectionEntry>();

  constructor(options: {
    observationWindowMs?: number;
    requestTimeoutMs?: number;
    handshakeTimeoutMs?: number;
    signApiKey?: string;
    connectionFactory?: TikTokConnectionFactory;
  } = {}) {
    this.observationWindowMs = options.observationWindowMs ?? 1_000;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 8_000;
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? 8_000;
    this.signApiKey = options.signApiKey;
    this.factory = options.connectionFactory ?? defaultFactory;
  }

  async collect(identifier: string): Promise<CollectorResult> {
    const startedAt = Date.now();
    const canonical = canonicalIdentifier(identifier);
    if (!canonical) return this.failure(identifier, canonical, startedAt, { code: 'USER_NOT_FOUND', retryable: false, message: 'tiktok identifier is empty' });

    let entry = this.connections.get(canonical);
    let connection: ProviderConnection | undefined = entry?.connection;
    let latestViewers = entry?.viewers ?? null;
    let comments = entry?.comments ?? 0;
    let likes = entry?.likes ?? 0;
    const recentComments = entry?.recentComments ?? [];
    const recentLikes = entry?.recentLikes ?? [];
    const recentGifts = entry?.recentGifts ?? [];
    let connected = entry?.connected ?? false;
    try {
      if (!connection || !connected) {
        connection = connection ?? this.factory(canonical, {
          fetchRoomInfoOnConnect: true,
          ...(this.signApiKey ? { signApiKey: this.signApiKey } : {}),
          webClientOptions: { timeout: this.requestTimeoutMs },
          wsClientOptions: { handshakeTimeout: this.handshakeTimeoutMs }
        });
        entry ??= { connection, roomId: null, viewers: latestViewers, comments, likes, recentComments, recentLikes, recentGifts, commentKeys: new Set(), connected: false, initialized: false, reconnectAttempt: 0, providerOccurredAt: null };
        this.connections.set(canonical, entry);
        if (!entry.initialized) connection.on(WebcastEvent.ROOM_USER, (data: unknown) => {
          const value = viewerCount((data as { total?: unknown }).total) ?? viewerCount((data as { totalUser?: unknown }).totalUser);
          if (value !== null) { latestViewers = value; entry!.viewers = value; }
          entry!.providerOccurredAt = providerTimestamp((data as { common?: { createTime?: unknown } }).common?.createTime);
        });
        if (!entry.initialized) connection.on(WebcastEvent.CHAT, (data: unknown) => {
          const value = data as { content?: unknown; user?: { uniqueId?: unknown; unique_id?: unknown; nickname?: unknown; userInfo?: { uniqueId?: unknown; unique_id?: unknown; nickname?: unknown } }; userInfo?: { uniqueId?: unknown; unique_id?: unknown; nickname?: unknown }; common?: { createTime?: unknown } };
          const text = boundedText(value.content, 500);
          const user = (value.user ?? value.userInfo) as { uniqueId?: unknown; unique_id?: unknown; nickname?: unknown; userInfo?: { uniqueId?: unknown; unique_id?: unknown; nickname?: unknown } } | undefined;
          const profile = user?.userInfo ?? user;
          const occurredAt = providerTimestamp(value.common?.createTime) ?? new Date();
          const username = boundedText(profile?.uniqueId ?? profile?.unique_id, 100);
          const displayName = boundedText(profile?.nickname, 100);
          const key = `${username}\u0000${displayName}\u0000${text}\u0000${occurredAt.toISOString()}`;
          if (text && !entry!.commentKeys.has(key)) { entry!.commentKeys.add(key); comments += 1; entry!.comments += 1; entry!.recentComments.push({ username, displayName, text, occurredAt }); if (entry!.recentComments.length > 100) entry!.recentComments.splice(0, entry!.recentComments.length - 100); if (entry!.commentKeys.size > 200) entry!.commentKeys.delete(entry!.commentKeys.values().next().value!); }
        });
        if (!entry.initialized) connection.on(WebcastEvent.LIKE, (data: unknown) => {
          const value = data as { count?: unknown; likeCount?: unknown; user?: { uniqueId?: unknown; nickname?: unknown }; common?: { createTime?: unknown } };
          const count = positiveInteger(value.count ?? value.likeCount);
          if (count > 0) {
            likes += count; entry!.likes += count;
            entry!.recentLikes.push({ username: boundedText(value.user?.uniqueId, 100), displayName: boundedText(value.user?.nickname, 100), count, occurredAt: providerTimestamp(value.common?.createTime) ?? new Date() });
          }
        });
        if (!entry.initialized) connection.on(WebcastEvent.GIFT, (data: unknown) => {
          const value = data as { giftId?: unknown; repeatCount?: unknown; repeatEnd?: unknown; gift?: { name?: unknown }; giftDetails?: { giftName?: unknown; giftType?: unknown; giftImage?: unknown }; extendedGiftInfo?: { name?: unknown; giftName?: unknown; giftImage?: unknown }; user?: { uniqueId?: unknown; nickname?: unknown }; common?: { createTime?: unknown } };
          const repeatEnd = value.repeatEnd === true;
          const giftType = positiveInteger(value.giftDetails?.giftType);
          if (giftType === 1 && !repeatEnd) return;
          const giftId = typeof value.giftId === 'string' || typeof value.giftId === 'number' ? value.giftId : '';
          const repeatCount = positiveInteger(value.repeatCount) || 1;
          const giftName = boundedText(value.extendedGiftInfo?.name ?? value.extendedGiftInfo?.giftName ?? value.giftDetails?.giftName ?? value.gift?.name, 150);
          if (giftId === '') return;
          entry!.recentGifts.push({ username: boundedText(value.user?.uniqueId, 100), displayName: boundedText(value.user?.nickname, 100), giftId, giftName, repeatCount, giftImageUrl: giftImageUrl(value.extendedGiftInfo?.giftImage ?? value.giftDetails?.giftImage), occurredAt: providerTimestamp(value.common?.createTime) ?? new Date() });
        });
        if (!entry.initialized) connection.on(ControlEvent.CONNECTED, () => {
          connected = true; entry!.connected = true;
          if (entry!.stableTimer) clearTimeout(entry!.stableTimer);
          entry!.stableTimer = setTimeout(() => { entry!.reconnectAttempt = 0; entry!.stableTimer = undefined; }, 30_000);
          entry!.stableTimer.unref();
          console.info(JSON.stringify({ event: 'tiktok_connected', identifier: canonical, roomId: entry!.roomId }));
        });
        if (!entry.initialized) connection.on(ControlEvent.DISCONNECTED, () => {
          connected = false; entry!.connected = false;
          if (entry!.stableTimer) { clearTimeout(entry!.stableTimer); entry!.stableTimer = undefined; }
          console.warn(JSON.stringify({ event: 'tiktok_disconnected', identifier: canonical }));
          this.scheduleReconnect(canonical, entry!);
        });
        if (!entry.initialized) connection.on(ControlEvent.ERROR, (data: unknown) => {
          const classified = classifyTikTokError(data);
          console.warn(JSON.stringify({ event: 'tiktok_provider_error', identifier: canonical, code: classified.code, message: classified.message }));
        });
        entry.initialized = true;
        if (entry.connecting) await entry.connecting;
        if (entry.connected) connected = true;
        else {
        if (entry.reconnectTimer) { clearTimeout(entry.reconnectTimer); entry.reconnectTimer = undefined; }
        const state = await connection.connect();
        connected = true;
        entry.connected = true;
        entry.roomId = typeof state.roomId === 'string' ? state.roomId : entry.roomId;
        latestViewers = latestViewers ?? roomInfoViewers(state.roomInfo);
        entry.viewers = latestViewers;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, entry ? this.observationWindowMs : 0));
      const deltaComments = entry ? entry.comments : comments;
      const deltaLikes = entry ? entry.likes : likes;
       const flushedComments = entry ? entry.recentComments.splice(0) : [];
       const flushedLikes = entry ? entry.recentLikes.splice(0) : [];
       const flushedGifts = entry ? entry.recentGifts.splice(0) : [];
       if (entry) { entry.comments = 0; entry.likes = 0; }
      return {
        provider: 'tiktok', requestedIdentifier: identifier, canonicalIdentifier: canonical, checkedAt: new Date(),
        collection: { successful: true, latencyMs: Date.now() - startedAt, providerOccurredAt: entry?.providerOccurredAt ?? null },
         observation: { providerLive: true, degraded: false, roomId: entry?.roomId ?? null, currentViewers: entry?.viewers ?? latestViewers, comments: deltaComments, likes: deltaLikes, recentComments: flushedComments, recentLikes: flushedLikes, recentGifts: flushedGifts, metadata: {} }, error: null
      };
    } catch (error) {
      const classified = classifyTikTokError(error);
      if (classified.code === 'STREAM_OFFLINE') {
        await this.stop(canonical);
        return {
          provider: 'tiktok', requestedIdentifier: identifier, canonicalIdentifier: canonical, checkedAt: new Date(),
          collection: { successful: true, latencyMs: Date.now() - startedAt, providerOccurredAt: null },
           observation: { providerLive: false, degraded: false, roomId: null, currentViewers: null, comments: 0, likes: 0, recentComments: [], recentLikes: [], recentGifts: [], metadata: {} }, error: null
        };
      }
      if (!connected) await this.stop(canonical);
      return this.failure(identifier, canonical, startedAt, classified, connected);
    }
  }

  async stop(identifier: string) {
    const canonical = canonicalIdentifier(identifier);
    const entry = this.connections.get(canonical);
    if (!entry) return;
    this.connections.delete(canonical);
    if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
    if (entry.stableTimer) clearTimeout(entry.stableTimer);
    await entry.connection.disconnect().catch(() => undefined);
    entry.connection.removeAllListeners?.();
  }

  async close() { await Promise.all([...this.connections.keys()].map((identifier) => this.stop(identifier))); }

  async prune(activeIdentifiers: Set<string>) {
    await Promise.all([...this.connections.keys()].filter((identifier) => !activeIdentifiers.has(identifier)).map((identifier) => this.stop(identifier)));
  }

  private scheduleReconnect(identifier: string, entry: ConnectionEntry) {
    if (entry.reconnectTimer || entry.connecting || this.connections.get(identifier) !== entry) return;
    const delay = Math.min(30_000, 1_000 * 2 ** entry.reconnectAttempt++);
    console.info(JSON.stringify({ event: 'tiktok_reconnect_scheduled', identifier, attempt: entry.reconnectAttempt, delayMs: delay }));
    entry.reconnectTimer = setTimeout(() => {
      entry.reconnectTimer = undefined;
      if (this.connections.get(identifier) !== entry || entry.connected) return;
      console.info(JSON.stringify({ event: 'tiktok_reconnect_attempt', identifier, attempt: entry.reconnectAttempt }));
      let retry = false;
      entry.connecting = entry.connection.connect().then((state) => {
        entry.connected = true;
        entry.roomId = typeof state.roomId === 'string' ? state.roomId : entry.roomId;
      }).catch((error) => {
        const classified = classifyTikTokError(error);
        if (classified.code === 'STREAM_OFFLINE') return this.stop(identifier);
        retry = true;
      }).finally(() => { entry.connecting = undefined; if (retry) this.scheduleReconnect(identifier, entry); });
    }, delay);
    entry.reconnectTimer.unref();
  }

  private failure(identifier: string, canonical: string, startedAt: number, error: CollectorResult extends { error: infer E } ? Exclude<E, null> : never, _connected = false): CollectorResult {
    return { provider: 'tiktok', requestedIdentifier: identifier, canonicalIdentifier: canonical, checkedAt: new Date(), collection: { successful: false, latencyMs: Date.now() - startedAt, providerOccurredAt: null }, observation: null, error };
  }
}
