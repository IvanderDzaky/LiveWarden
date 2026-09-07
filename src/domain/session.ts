export type SessionAction = 'CREATE_OR_CONTINUE' | 'CLOSE' | 'NOOP';

export const sessionAction = (status: 'LIVE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN' | 'DISCONNECTED'): SessionAction => {
  if (status === 'LIVE' || status === 'DEGRADED') return 'CREATE_OR_CONTINUE';
  if (status === 'OFFLINE') return 'CLOSE';
  return 'NOOP';
};
