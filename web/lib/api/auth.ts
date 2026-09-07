export type User = { id: string; email: string; createdAt: string };
export type ApiError = { code: string; message: string; details: Record<string, unknown>; requestId: string };

export class AuthApiError extends Error {
  readonly code: string;
  readonly requestId: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'AuthApiError';
    this.code = error.code;
    this.requestId = error.requestId;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(url, { ...init, credentials: 'include', headers });
  const body = await response.json().catch(() => null) as { data?: T; error?: ApiError } | null;
  if (!response.ok || !body?.data) throw new AuthApiError(body?.error ?? { code: 'INTERNAL_ERROR', message: 'Request failed', details: {}, requestId: '' });
  return body.data;
}

export const getCurrentUser = () => request<{ user: User }>('/api/auth/me');
export const login = (email: string, password: string) => request<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const register = (email: string, password: string) => request<{ user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });
export const logout = () => request<{ success: true }>('/api/auth/logout', { method: 'POST' });
