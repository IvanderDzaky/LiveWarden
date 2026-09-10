import pg from 'pg';
import type { FastifyBaseLogger } from 'fastify';
import { eq } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/client.js';
import { streams } from '../db/schema.js';
import { REALTIME_CHANNEL, realtimeEventSchema, type RealtimeEvent } from './events.js';

type Subscriber = { userId: string; streamId: string | null; send(event: RealtimeEvent): boolean; resync(): boolean; close(): void };

export class RealtimeHub {
  private client: pg.Client | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private connecting = false;
  private closed = false;
  private readonly subscribers = new Set<Subscriber>();

  constructor(private readonly logger: FastifyBaseLogger, private readonly connectionString = config.DATABASE_URL) {}

  async start() { await this.connect(); }

  subscribe(subscriber: Subscriber) {
    if (this.closed) throw new Error('realtime hub is closed');
    if ([...this.subscribers].filter((item) => item.userId === subscriber.userId).length >= 10) throw new Error('realtime subscription limit exceeded');
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  get subscriberCount() { return this.subscribers.size; }

  async close() {
    if (this.closed) return;
    this.closed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    for (const subscriber of this.subscribers) subscriber.close();
    this.subscribers.clear();
    const client = this.client;
    this.client = null;
    if (client) {
      client.removeAllListeners();
      await client.query(`UNLISTEN ${REALTIME_CHANNEL}`).catch(() => undefined);
      await client.end().catch(() => undefined);
    }
  }

  private async connect() {
    if (this.closed || this.connecting) return;
    this.connecting = true;
    const client = new pg.Client({ connectionString: this.connectionString, application_name: 'livewarden-realtime-listener' });
    try {
      await client.connect();
      await client.query(`LISTEN ${REALTIME_CHANNEL}`);
      if (this.closed) { await client.end(); return; }
      this.client = client;
      this.reconnectAttempt = 0;
      client.on('notification', (message) => void this.onNotification(message.payload).catch((error) => this.logger.error({ err: error, event: 'realtime_dispatch_error' }, 'Realtime notification dispatch failed')));
      client.once('error', (error) => this.onDisconnect(client, error));
      client.once('end', () => this.onDisconnect(client));
      this.logger.info({ event: 'realtime_listener_connected' }, 'PostgreSQL realtime listener connected');
      for (const subscriber of this.subscribers) if (!subscriber.resync()) this.removeSubscriber(subscriber);
    } catch (error) {
      await client.end().catch(() => undefined);
      this.logger.error({ err: error, event: 'realtime_listener_error' }, 'PostgreSQL realtime listener failed');
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private onDisconnect(client: pg.Client, error?: Error) {
    if (client !== this.client) return;
    this.client = null;
    client.removeAllListeners();
    if (error) this.logger.error({ err: error, event: 'realtime_listener_error' }, 'PostgreSQL realtime listener disconnected');
    if (!this.closed) {
      for (const subscriber of this.subscribers) if (!subscriber.resync()) this.removeSubscriber(subscriber);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.closed || this.reconnectTimer) return;
    const delay = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempt++);
    this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; void this.connect(); }, delay);
    this.reconnectTimer.unref();
  }

  private async onNotification(payload?: string) {
    let parsed: unknown;
    try { parsed = payload ? JSON.parse(payload) : null; } catch { return; }
    const result = realtimeEventSchema.safeParse(parsed);
    if (!result.success) return;
    const owner = (await db.select({ userId: streams.userId }).from(streams).where(eq(streams.id, result.data.streamId)).limit(1))[0];
    if (!owner) return;
    let delivered = 0;
    for (const subscriber of this.subscribers) {
      if (subscriber.userId !== owner.userId || (subscriber.streamId && subscriber.streamId !== result.data.streamId)) continue;
      if (subscriber.send(result.data)) delivered += 1;
      else this.removeSubscriber(subscriber);
    }
    if (delivered > 0 && result.data.type !== 'stream.comment' && result.data.type !== 'stream.like' && result.data.type !== 'stream.gift') {
      this.logger.debug({ event: 'realtime_event_delivered', type: result.data.type, streamId: result.data.streamId, clients: delivered }, 'Realtime event delivered');
    }
  }

  private removeSubscriber(subscriber: Subscriber) {
    this.subscribers.delete(subscriber);
    subscriber.close();
  }
}
