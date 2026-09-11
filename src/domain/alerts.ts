export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
export type AlertRuleType = 'MONITORING_FAILURE' | 'CONNECTION_FAILURE' | 'VIEWER_DROP' | 'COMMENT_ACTIVITY_SPIKE' | 'GIFT_ACTIVITY_SPIKE' | 'STALE_DATA';

export const alertDedupeKey = (streamId: string, rule: AlertRuleType) =>
  `stream:${streamId}:rule:${rule}`;

export const monitoringFailureCandidate = (consecutiveFailures: number) =>
  consecutiveFailures >= 3 ? {
    type: 'MONITORING_FAILURE' as const,
    severity: 'WARNING' as const,
    description: 'Monitoring failed for three consecutive checks',
    recommendedAction: 'Check monitoring connectivity and provider availability'
  } : null;

export const connectionFailureCandidate = (status: string) => status === 'DISCONNECTED' ? {
  type: 'CONNECTION_FAILURE' as const,
  severity: 'CRITICAL' as const,
  description: 'Monitoring provider connection is unavailable',
  recommendedAction: 'Check provider connection and collector configuration'
} : null;

// MVP thresholds: viewer count halves, or at least 10 comments arrive in one check.
export const viewerDropCandidate = (previous: number | null, current: number | null) =>
  previous !== null && current !== null && previous > 0 && current <= previous * 0.5 ? {
    type: 'VIEWER_DROP' as const,
    severity: 'WARNING' as const,
    description: 'Viewer count dropped by at least 50% from the previous snapshot',
    recommendedAction: 'Check stream quality and audience retention',
    triggerValue: { previous, current, dropRatio: 1 - current / previous }
  } : null;

export const commentActivityCandidate = (count: number) => count >= 10 ? {
  type: 'COMMENT_ACTIVITY_SPIKE' as const,
  severity: 'INFO' as const,
  description: 'Comment activity reached at least 10 comments in one check',
  recommendedAction: 'Review audience activity for notable moments',
  triggerValue: { count }
} : null;

export const giftActivityCandidate = (quantity: number) => quantity >= 10 ? {
  type: 'GIFT_ACTIVITY_SPIKE' as const,
  severity: 'INFO' as const,
  description: 'Gift activity reached at least 10 items in one check',
  recommendedAction: 'Review gift activity and audience engagement',
  triggerValue: { quantity }
} : null;

export const staleDataCandidate = (lastSuccessfulAt: Date | null, checkedAt: Date, thresholdMs = 5 * 60 * 1000) => lastSuccessfulAt && checkedAt.getTime() - lastSuccessfulAt.getTime() >= thresholdMs ? {
  type: 'STALE_DATA' as const,
  severity: 'WARNING' as const,
  description: 'Monitoring data has been stale for at least five minutes',
  recommendedAction: 'Check collector connectivity and provider availability',
  triggerValue: { ageSeconds: Math.floor((checkedAt.getTime() - lastSuccessfulAt.getTime()) / 1000) }
} : null;
