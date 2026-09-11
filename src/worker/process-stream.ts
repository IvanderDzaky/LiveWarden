import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { alerts, events, liveSessions, monitoringSnapshots, streams } from '../db/schema.js';
import type { Collector, CollectorResult } from '../domain/collector.js';
import { statusFromResult } from '../domain/status.js';
import { activityIdempotencyKey, activityPayload, commentIdempotencyKey, lifecycleIdempotencyKey } from '../domain/events.js';
import { alertDedupeKey, commentActivityCandidate, connectionFailureCandidate, monitoringFailureCandidate, viewerDropCandidate } from '../domain/alerts.js';
import { detectAlert, findUnresolvedAlert, resolveAlert } from './alert-repository.js';
import { createAlertDeliveryIntent } from './delivery-intent.js';
import { publishRealtimeEvent, type RealtimeEvent } from '../realtime/events.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, identifier: string): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`collector timeout: ${identifier}`)), timeoutMs); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const timeoutResult = (identifier: string, timeoutMs: number, provider: CollectorResult['provider']): CollectorResult => ({
  provider, requestedIdentifier: identifier, canonicalIdentifier: identifier.replace(/^@/, ''), checkedAt: new Date(),
  collection: { successful: false, latencyMs: timeoutMs, providerOccurredAt: null }, observation: null,
  error: { code: 'COLLECTOR_TIMEOUT', retryable: true, message: 'collector timeout' }
});

export const processStream = async (stream: typeof streams.$inferSelect, token: string, collector: Collector, options: {
  timeoutMs: number; retries: number; retryBackoffMs: number; intervalMs: number;
}) => {
  let result: CollectorResult;
  try {
    result = await withTimeout(collector.collect(stream.externalIdentifier, { timeoutMs: options.timeoutMs }), options.timeoutMs, stream.externalIdentifier);
  } catch {
    result = timeoutResult(stream.externalIdentifier, options.timeoutMs, collector.provider);
  }
  let retries = 0;
  while (!result.collection.successful && result.error !== null && result.error.retryable && retries < options.retries) {
    retries += 1;
    await sleep(options.retryBackoffMs * 2 ** (retries - 1));
    try {
      result = await withTimeout(collector.collect(stream.externalIdentifier, { timeoutMs: options.timeoutMs }), options.timeoutMs, stream.externalIdentifier);
    } catch {
      result = timeoutResult(stream.externalIdentifier, options.timeoutMs, collector.provider);
    }
  }
  const status = statusFromResult(result);
  const checkedAt = result.checkedAt;
  const attemptKey = crypto.randomUUID();

  await db.transaction(async (tx) => {
    const current = (await tx.select().from(streams).where(eq(streams.id, stream.id)).for('update'))[0];
    if (!current || current.checkLeaseToken !== token) return;
    const observation = result.observation;
    const active = (await tx.select().from(liveSessions).where(and(eq(liveSessions.streamId, stream.id), isNull(liveSessions.endedAt))).limit(1))[0];
    const sameRoom = !active?.providerRoomId || !observation?.roomId || active.providerRoomId === observation.roomId;
    let sessionId = active && sameRoom ? active.id : null;
    const previousMonitoringAlert = (await findUnresolvedAlert(tx, alertDedupeKey(stream.id, 'MONITORING_FAILURE')))[0];
    const previousConnectionAlert = (await findUnresolvedAlert(tx, alertDedupeKey(stream.id, 'CONNECTION_FAILURE')))[0];
    const realtime: Array<Omit<RealtimeEvent, 'id' | 'schemaVersion'>> = [];
    let alertChanged = false;

    if (observation && (status === 'LIVE' || status === 'DEGRADED') && !active) {
      const created = await tx.insert(liveSessions).values({
        streamId: stream.id, providerRoomId: observation.roomId, startedAt: checkedAt
      }).returning({ id: liveSessions.id });
      sessionId = created[0].id;
      await tx.insert(events).values({
        type: 'STREAM_STARTED', streamId: stream.id, liveSessionId: sessionId, source: 'live_warden',
        occurredAt: checkedAt, receivedAt: checkedAt, idempotencyKey: lifecycleIdempotencyKey(stream.id, sessionId, 'started'),
        payload: { providerRoomId: observation.roomId }, metadata: {}
      }).onConflictDoNothing();
    }

    await tx.insert(monitoringSnapshots).values({
      streamId: stream.id,
      liveSessionId: sessionId,
      attemptKey,
      checkedAt,
      providerOccurredAt: observation ? result.collection.providerOccurredAt : null,
      collectionSucceeded: result.collection.successful,
      statusObserved: status,
      providerRoomId: observation?.roomId ?? null,
      currentViewers: observation?.currentViewers ?? null,
      collectorLatencyMs: result.collection.latencyMs,
      errorCode: result.error?.code ?? null,
      errorMessage: result.error?.message ?? null,
      providerMetadata: observation?.metadata ?? null
    }).onConflictDoNothing();

    if (sessionId && observation && (status === 'LIVE' || status === 'DEGRADED')) {
      await tx.update(liveSessions).set({
        peakViewers: observation.currentViewers === null ? undefined : sql`greatest(coalesce(${liveSessions.peakViewers}, 0), ${observation.currentViewers})`,
        averageViewers: sql`(select avg(current_viewers) from monitoring_snapshots where live_session_id = ${sessionId} and current_viewers is not null)`
      }).where(eq(liveSessions.id, sessionId));
    }

    if (status === 'OFFLINE' && active) {
      await tx.update(liveSessions).set({
        endedAt: checkedAt,
        state: 'COMPLETED',
        finalStatus: 'OFFLINE',
        durationSeconds: sql`GREATEST(0, EXTRACT(EPOCH FROM (${checkedAt} - ${liveSessions.startedAt})))::bigint`,
        peakViewers: sql`(SELECT MAX(current_viewers) FROM monitoring_snapshots WHERE live_session_id = ${active.id})`,
        averageViewers: sql`(SELECT AVG(current_viewers) FROM monitoring_snapshots WHERE live_session_id = ${active.id} AND current_viewers IS NOT NULL)`
      }).where(and(eq(liveSessions.id, active.id), eq(liveSessions.state, 'ACTIVE')));
      await tx.insert(events).values({
        type: 'STREAM_ENDED', streamId: stream.id, liveSessionId: active.id, source: 'live_warden',
        occurredAt: checkedAt, receivedAt: checkedAt, idempotencyKey: lifecycleIdempotencyKey(stream.id, active.id, 'ended'),
        payload: { finalStatus: 'OFFLINE' }, metadata: {}
      }).onConflictDoNothing().returning({ id: events.id });
    }

    if (observation && (status === 'LIVE' || status === 'DEGRADED') && sessionId) {
      if (observation.comments > 0) await tx.insert(events).values({
        type: 'COMMENT', streamId: stream.id, liveSessionId: sessionId, source: result.provider,
        occurredAt: checkedAt, receivedAt: checkedAt, idempotencyKey: commentIdempotencyKey(stream.id, sessionId, observation.recentComments),
        payload: { ...activityPayload(observation.comments), comments: observation.recentComments.map(({ username, displayName, text }) => ({ username, displayName, text })) }, metadata: {}
      }).onConflictDoNothing();
      if (observation.likes > 0) await tx.insert(events).values({
        type: 'LIKE', streamId: stream.id, liveSessionId: sessionId, source: result.provider,
        occurredAt: checkedAt, receivedAt: checkedAt, idempotencyKey: activityIdempotencyKey(stream.id, attemptKey, 'like'),
        payload: { ...activityPayload(observation.likes), likes: observation.recentLikes.map(({ username, displayName, count, occurredAt }) => ({ username, displayName, count, occurredAt })) }, metadata: {}
      }).onConflictDoNothing();
      if (observation.recentGifts.length > 0) await tx.insert(events).values({
        type: 'GIFT', streamId: stream.id, liveSessionId: sessionId, source: result.provider,
        occurredAt: checkedAt, receivedAt: checkedAt, idempotencyKey: activityIdempotencyKey(stream.id, attemptKey, 'gift'),
        payload: { gifts: observation.recentGifts }, metadata: {}
      }).onConflictDoNothing();

      const previousSnapshot = (await tx.select({ currentViewers: monitoringSnapshots.currentViewers }).from(monitoringSnapshots).where(and(eq(monitoringSnapshots.liveSessionId, sessionId), sql`${monitoringSnapshots.attemptKey} <> ${attemptKey}`)).orderBy(sql`${monitoringSnapshots.checkedAt} desc`).limit(1))[0];
      const viewerDrop = viewerDropCandidate(previousSnapshot?.currentViewers ?? null, observation.currentViewers);
      if (viewerDrop) {
        const inserted = await tx.insert(events).values({ type: 'VIEWER_DROP', streamId: stream.id, liveSessionId: sessionId, source: 'live_warden', occurredAt: checkedAt, receivedAt: checkedAt, idempotencyKey: activityIdempotencyKey(stream.id, attemptKey, 'viewer-drop'), payload: viewerDrop.triggerValue, metadata: {} }).onConflictDoNothing().returning({ id: events.id });
        const detected = await detectAlert(tx, { streamId: stream.id, sessionId, sourceEventId: inserted[0]?.id ?? null, type: viewerDrop.type, severity: viewerDrop.severity, detectedAt: checkedAt, description: viewerDrop.description, recommendedAction: viewerDrop.recommendedAction, triggerValue: viewerDrop.triggerValue });
        alertChanged = true;
        if (detected.created) { alertChanged = true; await createAlertDeliveryIntent(tx, { alertId: detected.id, eventId: inserted[0]?.id ?? null, sessionId, deliveryType: 'ALERT_CREATED' }); }
      } else {
        const recovered = await resolveAlert(tx, stream.id, 'VIEWER_DROP', checkedAt, { current: observation.currentViewers });
        if (recovered) { alertChanged = true; await createAlertDeliveryIntent(tx, { alertId: recovered.id, eventId: null, sessionId, deliveryType: 'ALERT_RESOLVED' }); }
      }
      const commentSpike = commentActivityCandidate(observation.comments);
      if (commentSpike) {
        const inserted = await tx.insert(events).values({ type: 'COMMENT_ACTIVITY_SPIKE', streamId: stream.id, liveSessionId: sessionId, source: 'live_warden', occurredAt: checkedAt, receivedAt: checkedAt, idempotencyKey: activityIdempotencyKey(stream.id, attemptKey, 'comment-spike'), payload: commentSpike.triggerValue, metadata: {} }).onConflictDoNothing().returning({ id: events.id });
        const detected = await detectAlert(tx, { streamId: stream.id, sessionId, sourceEventId: inserted[0]?.id ?? null, type: commentSpike.type, severity: commentSpike.severity, detectedAt: checkedAt, description: commentSpike.description, recommendedAction: commentSpike.recommendedAction, triggerValue: commentSpike.triggerValue });
        alertChanged = true;
        if (detected.created) { alertChanged = true; await createAlertDeliveryIntent(tx, { alertId: detected.id, eventId: inserted[0]?.id ?? null, sessionId, deliveryType: 'ALERT_CREATED' }); }
      } else {
        const recovered = await resolveAlert(tx, stream.id, 'COMMENT_ACTIVITY_SPIKE', checkedAt, { count: observation.comments });
        if (recovered) { alertChanged = true; await createAlertDeliveryIntent(tx, { alertId: recovered.id, eventId: null, sessionId, deliveryType: 'ALERT_RESOLVED' }); }
      }
      await tx.update(liveSessions).set({
        totalComments: sql`coalesce((select sum((payload->>'count')::bigint) from events where live_session_id = ${sessionId} and type = 'COMMENT'), 0)`,
        totalLikeActivity: sql`coalesce((select sum((payload->>'count')::bigint) from events where live_session_id = ${sessionId} and type = 'LIKE'), 0)`,
        totalGifts: sql`coalesce((select sum(jsonb_array_length(payload->'gifts')) from events where live_session_id = ${sessionId} and type = 'GIFT'), 0)`,
        totalGiftQuantity: sql`coalesce((select sum((gift->>'repeatCount')::bigint) from events, jsonb_array_elements(payload->'gifts') gift where live_session_id = ${sessionId} and type = 'GIFT'), 0)`,
        totalGiftCoins: sql`case when exists (select 1 from events, jsonb_array_elements(payload->'gifts') gift where live_session_id = ${sessionId} and type = 'GIFT' and gift->>'coinCount' is null) then null else coalesce((select sum((gift->>'coinCount')::bigint) from events, jsonb_array_elements(payload->'gifts') gift where live_session_id = ${sessionId} and type = 'GIFT'), 0) end`,
        updatedAt: checkedAt
      }).where(eq(liveSessions.id, sessionId));
    }

    let failureEventId: string | null = null;
    if (status === 'UNKNOWN' || status === 'DISCONNECTED') {
      const eventType = status === 'DISCONNECTED' ? 'CONNECTION_LOST' : 'MONITORING_FAILED';
      const inserted = await tx.insert(events).values({
        type: eventType, streamId: stream.id, liveSessionId: sessionId, source: 'live_warden',
        occurredAt: checkedAt, receivedAt: checkedAt, idempotencyKey: `stream:${stream.id}:attempt:${attemptKey}:${eventType.toLowerCase()}`,
        payload: { errorCode: result.error?.code ?? null }, metadata: {}
      }).onConflictDoNothing().returning({ id: events.id });
      failureEventId = inserted[0]?.id ?? null;

      const recentSnapshots = await tx.select({ collectionSucceeded: monitoringSnapshots.collectionSucceeded })
        .from(monitoringSnapshots).where(eq(monitoringSnapshots.streamId, stream.id))
        .orderBy(sql`${monitoringSnapshots.checkedAt} desc`).limit(3);
      let consecutiveFailures = 0;
      for (const snapshot of recentSnapshots) {
        if (snapshot.collectionSucceeded) break;
        consecutiveFailures += 1;
      }
      const monitoring = monitoringFailureCandidate(consecutiveFailures);
      if (monitoring && status === 'UNKNOWN') {
        const detected = await detectAlert(tx, {
        streamId: stream.id, sessionId, sourceEventId: failureEventId, type: monitoring.type,
        severity: monitoring.severity, detectedAt: checkedAt, description: monitoring.description,
        recommendedAction: monitoring.recommendedAction, triggerValue: { consecutiveFailures }
        });
        alertChanged = true;
        if (detected.created) { alertChanged = true; await createAlertDeliveryIntent(tx, { alertId: detected.id, eventId: failureEventId, sessionId, deliveryType: 'ALERT_CREATED' }); }
      }
      const connection = connectionFailureCandidate(status);
      if (connection) {
        const detected = await detectAlert(tx, {
        streamId: stream.id, sessionId, sourceEventId: failureEventId, type: connection.type,
        severity: connection.severity, detectedAt: checkedAt, description: connection.description,
        recommendedAction: connection.recommendedAction, triggerValue: { errorCode: result.error?.code ?? null }
        });
        alertChanged = true;
        if (detected.created) { alertChanged = true; await createAlertDeliveryIntent(tx, { alertId: detected.id, eventId: failureEventId, sessionId, deliveryType: 'ALERT_CREATED' }); }
      }
    }

    const recovered = result.collection.successful && observation && (status === 'LIVE' || status === 'OFFLINE');
    if (recovered && previousMonitoringAlert) {
      const inserted = await tx.insert(events).values({
        type: 'MONITORING_RECOVERED', streamId: stream.id, liveSessionId: sessionId, source: 'live_warden',
        occurredAt: checkedAt, receivedAt: checkedAt, idempotencyKey: `stream:${stream.id}:attempt:${attemptKey}:monitoring_recovered`,
        payload: { status }, metadata: {}
      }).returning({ id: events.id });
      const resolved = await resolveAlert(tx, stream.id, 'MONITORING_FAILURE', checkedAt, { status, sourceEventId: inserted[0]?.id ?? null });
      if (resolved) { alertChanged = true; await createAlertDeliveryIntent(tx, { alertId: resolved.id, eventId: inserted[0]?.id ?? null, sessionId, deliveryType: 'ALERT_RESOLVED' }); }
    }
    if (recovered && previousConnectionAlert) {
      const inserted = await tx.insert(events).values({
        type: 'CONNECTION_RECOVERED', streamId: stream.id, liveSessionId: sessionId, source: 'live_warden',
        occurredAt: checkedAt, receivedAt: checkedAt, idempotencyKey: `stream:${stream.id}:attempt:${attemptKey}:connection_recovered`,
        payload: { status }, metadata: {}
      }).returning({ id: events.id });
      const resolved = await resolveAlert(tx, stream.id, 'CONNECTION_FAILURE', checkedAt, { status, sourceEventId: inserted[0]?.id ?? null });
      if (resolved) { alertChanged = true; await createAlertDeliveryIntent(tx, { alertId: resolved.id, eventId: inserted[0]?.id ?? null, sessionId, deliveryType: 'ALERT_RESOLVED' }); }
    }

    if (sessionId) await tx.update(liveSessions).set({
      eventCount: sql`(select count(*) from events where live_session_id = ${sessionId})`,
      alertCount: sql`(select count(*) from alerts where live_session_id = ${sessionId})`,
      updatedAt: checkedAt
    }).where(eq(liveSessions.id, sessionId));

    await tx.update(streams).set({
      status,
      lastCheckedAt: checkedAt,
      lastSuccessfulAt: result.collection.successful ? checkedAt : current.lastSuccessfulAt,
      lastObservedProviderAt: result.collection.providerOccurredAt ?? current.lastObservedProviderAt,
      lastRoomId: observation?.roomId ?? current.lastRoomId,
      lastObservationMetadata: observation?.metadata ?? current.lastObservationMetadata,
      nextCheckAt: new Date(checkedAt.getTime() + options.intervalMs),
      checkLeaseUntil: null,
      checkLeaseToken: null,
      updatedAt: checkedAt
    }).where(and(eq(streams.id, stream.id), eq(streams.checkLeaseToken, token)));

    const occurredAt = checkedAt.toISOString();
    realtime.push({ type: 'stream.status', streamId: stream.id, identifier: stream.externalIdentifier, occurredAt, payload: { status, collectionSucceeded: result.collection.successful, roomId: observation?.roomId ?? null } });
    if (observation?.currentViewers !== null && observation?.currentViewers !== undefined) realtime.push({ type: 'stream.viewer_count', streamId: stream.id, identifier: stream.externalIdentifier, occurredAt, payload: { currentViewers: observation.currentViewers } });
    if (observation && observation.comments > 0) realtime.push({ type: 'stream.comment', streamId: stream.id, identifier: stream.externalIdentifier, occurredAt, payload: { count: observation.comments } });
    if (observation && observation.likes > 0) realtime.push({ type: 'stream.like', streamId: stream.id, identifier: stream.externalIdentifier, occurredAt, payload: { count: observation.likes } });
    if (observation && observation.recentGifts.length > 0) realtime.push({ type: 'stream.gift', streamId: stream.id, identifier: stream.externalIdentifier, occurredAt, payload: { count: observation.recentGifts.length } });
    if (alertChanged) realtime.push({ type: 'stream.alert', streamId: stream.id, identifier: stream.externalIdentifier, occurredAt, payload: { action: 'changed' } });
    for (const event of realtime) await publishRealtimeEvent(tx, event);
  });
  if (status === 'OFFLINE') await collector.stop?.(stream.externalIdentifier);
};
