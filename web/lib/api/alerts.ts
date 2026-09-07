export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
export type Alert = { id: string; streamId: string; liveSessionId: string | null; sourceEventId?: string | null; type: string; severity: AlertSeverity; status: AlertStatus; firstDetectedAt: string; lastDetectedAt: string; acknowledgedAt: string | null; resolvedAt: string | null; description: string; triggerValue: unknown; recommendedAction: string | null; acknowledgements?: Array<{ id: string; acknowledgedAt: string; note: string | null }> };

export class AlertApiError extends Error {
  readonly code: string;
  readonly requestId: string;
  constructor(error: { code: string; message: string; requestId: string }) { super(error.message); this.name = 'AlertApiError'; this.code = error.code; this.requestId = error.requestId; }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => null) as { data?: T; error?: { code: string; message: string; requestId: string } } | null;
  if (!response.ok || body?.data === undefined) throw new AlertApiError(body?.error ?? { code: 'INTERNAL_ERROR', message: 'Request failed', requestId: '' });
  return body.data;
}

export const listAlerts = (filters: { severity?: AlertSeverity; status?: AlertStatus } = {}) => { const params = new URLSearchParams({ limit: '100' }); if (filters.severity) params.set('severity', filters.severity); if (filters.status) params.set('status', filters.status); return request<{ alerts: Alert[] }>(`/api/alerts?${params}`); };
export const getAlert = (id: string) => request<{ alert: Alert }>(`/api/alerts/${id}`);
export const acknowledgeAlert = (id: string, note?: string) => request<{ alert: Alert }>(`/api/alerts/${id}/acknowledgements`, { method: 'POST', body: JSON.stringify(note ? { note } : {}) });
