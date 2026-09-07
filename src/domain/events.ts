import { createHash } from 'node:crypto';

export const EVENT_TYPES = ['STREAM_STARTED', 'STREAM_ENDED', 'COMMENT', 'LIKE', 'VIEWER_SPIKE', 'VIEWER_DROP', 'COMMENT_ACTIVITY_SPIKE', 'GIFT_ACTIVITY_SPIKE', 'MONITORING_FAILED', 'MONITORING_RECOVERED', 'CONNECTION_LOST', 'CONNECTION_RECOVERED'] as const;
export type EventType = typeof EVENT_TYPES[number];

export const lifecycleIdempotencyKey = (streamId: string, sessionId: string, type: 'started' | 'ended') =>
  `stream:${streamId}:session:${sessionId}:${type}`;

export const activityIdempotencyKey = (streamId: string, attemptKey: string, type: 'comment' | 'like' | 'viewer-drop' | 'comment-spike') =>
  `stream:${streamId}:attempt:${attemptKey}:${type}`;

export const commentIdempotencyKey = (streamId: string, sessionId: string, comments: { username: string; displayName: string; text: string; occurredAt: Date }[]) => {
  const fingerprint = comments.map((comment) => [comment.username, comment.displayName, comment.text, comment.occurredAt.toISOString()].join('\u0000')).sort().join('\u0001');
  return `stream:${streamId}:session:${sessionId}:comments:${createHash('sha256').update(fingerprint).digest('base64url')}`;
};

export const activityPayload = (count: number) => {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('activity count must be a positive integer');
  return { count };
};
