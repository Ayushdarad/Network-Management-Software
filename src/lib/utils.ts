// ─── Shared utility helpers ───────────────────────────────────
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUptime(uptime: string): string {
  return uptime;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'online':  return 'text-emerald-400';
    case 'offline': return 'text-red-400';
    case 'warning': return 'text-amber-400';
    default:        return 'text-slate-400';
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'badge-critical';
    case 'warning':  return 'badge-warning';
    case 'info':     return 'badge-info';
    default:         return 'badge-unknown';
  }
}

export function getJobStatusColor(status: string): string {
  switch (status) {
    case 'success':   return 'text-emerald-400';
    case 'failed':    return 'text-red-400';
    case 'running':   return 'text-blue-400';
    case 'paused':    return 'text-amber-400';
    case 'scheduled': return 'text-slate-400';
    default:          return 'text-slate-400';
  }
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return '—';
  // Backend returns ISO strings tagged as Z but values are actually in local time.
  // Strip the Z so Date() treats the string as local time (no UTC→local conversion).
  const normalized = dateStr.endsWith('Z') ? dateStr.slice(0, -1) : dateStr;
  const now  = Date.now();
  const past = new Date(normalized).getTime();
  const diffMs   = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  // Strip the trailing Z so the browser treats the value as local time.
  const normalized = dateStr.endsWith('Z') ? dateStr.slice(0, -1) : dateStr;
  return new Date(normalized).toLocaleString(undefined, {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}



export function generateTimeLabels(points: number, intervalMinutes = 5): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = points - 1; i >= 0; i--) {
    const t = new Date(now.getTime() - i * intervalMinutes * 60000);
    labels.push(t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  }
  return labels;
}
