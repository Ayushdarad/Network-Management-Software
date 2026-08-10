/**
 * Typed API client for Tecsidel NMS backend.
 * All pages should import from here instead of mock data files.
 */

import { disconnectSharedSocket } from './socket';

const BASE_URL = '/api';

function getToken(): string | null {
  return localStorage.getItem('nms_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('nms_token');
    localStorage.removeItem('nms_user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized access');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: number; name: string; email: string; role: string } }>(
      '/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  me: () => request<{ user: any }>('/auth/me'),
  logout: async () => {
    // Tell the backend to mark user offline before clearing token
    try {
      await request<{ message: string }>('/auth/logout', { method: 'POST' });
    } catch { /* ignore errors, still logout locally */ }
    disconnectSharedSocket();
    localStorage.removeItem('nms_token');
    localStorage.removeItem('nms_user');
    window.location.href = '/login';
  },
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
};

// ─── Devices ──────────────────────────────────────────────────────────────────
export const devicesApi = {
  list: (params?: { status?: string; site?: string; type?: string; search?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request<{ data: any[]; total: number }>(`/devices${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => request<any>(`/devices/${id}`),
  create: (data: any) => request<any>('/devices', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/devices/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/devices/${id}`, { method: 'DELETE' }),
  poll: (id: string) => request<any>(`/devices/${id}/poll`, { method: 'POST' }),
  metrics: (id: string) => request<{ data: any[] }>(`/devices/${id}/metrics`),
  timeline: (id: string, range: string) => request<any>(`/devices/${id}/timeline?range=${range}&_=${Date.now()}`),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: (params?: { severity?: string; status?: string; site?: string; search?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request<{ data: any[]; counts: any; total: number }>(`/alerts${qs ? '?' + qs : ''}`);
  },
  get: (id: string) => request<any>(`/alerts/${id}`),
  acknowledge: (id: string) => request<any>(`/alerts/${id}/acknowledge`, { method: 'POST' }),
  resolve: (id: string) => request<any>(`/alerts/${id}/resolve`, { method: 'POST' }),
  delete: (id: string) => request<any>(`/alerts/${id}`, { method: 'DELETE' }),
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobsApi = {
  list: () => request<{ data: any[]; total: number }>('/jobs'),
  get: (id: string) => request<any>(`/jobs/${id}`),
  create: (data: any) => request<any>('/jobs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/jobs/${id}`, { method: 'DELETE' }),
  run: (id: string) => request<any>(`/jobs/${id}/run`, { method: 'POST' }),
  pause: (id: string) => request<any>(`/jobs/${id}/pause`, { method: 'POST' }),
  resume: (id: string) => request<any>(`/jobs/${id}/resume`, { method: 'POST' }),
  history: (id: string) => request<{ data: any[]; total: number }>(`/jobs/${id}/history`),
};

// ─── Logs ─────────────────────────────────────────────────────────────────────
export const logsApi = {
  list: (params?: { level?: string; device?: string; search?: string; from?: string; to?: string; limit?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request<{ data: any[]; total: number }>(`/logs${qs ? '?' + qs : ''}`);
  },
  audit: (params?: { user?: string; action?: string; search?: string; limit?: string }) => {
    const qs = new URLSearchParams(params as any).toString();
    return request<{ data: any[]; total: number }>(`/logs/audit${qs ? '?' + qs : ''}`);
  },
};

// ─── Settings ─────────────────────────────────────────────────
export const settingsApi = {
  get: () => request<Record<string, any>>('/settings'),
  update: (data: Record<string, any>) => request<Record<string, any>>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  updatePermissions: (data: Record<string, string[]>) => request<{ permissions: Record<string, string[]> }>('/settings/permissions', { method: 'PUT', body: JSON.stringify(data) }),
};

// ─── Users ────────────────────────────────────────────────────
export const usersApi = {
  list: () => request<{ data: any[]; total: number }>('/users'),
  get: (id: number) => request<any>(`/users/${id}`),
  create: (data: any) => request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => request<any>(`/users/${id}`, { method: 'DELETE' }),
};

// ─── Assets ───────────────────────────────────────────────────────────────────
export const assetsApi = {
  list: () => request<any[]>('/assets'),
  create: (data: any) => request<any>('/assets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request<any>(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<any>(`/assets/${id}`, { method: 'DELETE' }),
};

// ─── Auth helpers ─────────────────────────────────────────────────────────────
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('nms_user') || 'null');
  } catch {
    return null;
  }
}
