import type { LucideIcon } from 'lucide-react';
import {
  Server, Bell, BarChart2, Settings, Clock, FileText,
  HardDrive, Users, Calendar, ScrollText,
} from 'lucide-react';

export interface SearchResult {
  id: string;
  label: string;
  subtitle?: string;
  path: string;
  category: string;
  icon: LucideIcon;
  keywords: string;
}

export const STATIC_SEARCH_ITEMS: SearchResult[] = [
  { id: 'nav-dashboard', label: 'Dashboard', path: '/dashboard', category: 'Pages', icon: BarChart2, keywords: 'dashboard noc overview home' },
  { id: 'nav-alerts', label: 'Alerts Center', path: '/monitoring/alerts', category: 'Pages', icon: Bell, keywords: 'alerts monitoring incidents problems' },
  { id: 'nav-hosts', label: 'Hosts & Services', path: '/monitoring/hosts', category: 'Pages', icon: Server, keywords: 'hosts services monitoring status' },
  { id: 'nav-timeline', label: 'Availability Timeline', path: '/monitoring/timeline', category: 'Pages', icon: Clock, keywords: 'timeline availability uptime downtime' },
  { id: 'nav-history', label: 'Host & Service History', path: '/monitoring/history', category: 'Pages', icon: Clock, keywords: 'history host service events' },
  { id: 'nav-inventory', label: 'Device Inventory', path: '/inventory/devices', category: 'Pages', icon: Server, keywords: 'inventory devices list' },
  { id: 'nav-assets', label: 'Asset Management', path: '/inventory/assets', category: 'Pages', icon: HardDrive, keywords: 'assets licenses equipment' },
  { id: 'nav-syslog', label: 'Event Timeline', path: '/logs/syslog', category: 'Pages', icon: FileText, keywords: 'logs syslog events' },
  { id: 'nav-audit', label: 'Audit Logs', path: '/logs/audit', category: 'Pages', icon: ScrollText, keywords: 'audit logs security' },
  { id: 'nav-scheduler', label: 'Scheduler', path: '/operations/scheduler', category: 'Pages', icon: Calendar, keywords: 'scheduler jobs tasks automation' },
  { id: 'nav-reports', label: 'Reports', path: '/reports', category: 'Pages', icon: BarChart2, keywords: 'reports analytics export csv' },
  { id: 'nav-settings', label: 'Settings', path: '/settings', category: 'Pages', icon: Settings, keywords: 'settings users configuration' },
];

function join(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

export function buildSearchIndex(data: {
  devices?: any[];
  alerts?: any[];
  jobs?: any[];
  logs?: any[];
  assets?: any[];
  users?: any[];
}): SearchResult[] {
  const items: SearchResult[] = [...STATIC_SEARCH_ITEMS];

  for (const d of data.devices ?? []) {
    items.push({
      id: `device-${d.id}`,
      label: d.hostname,
      subtitle: `${d.ip} · ${d.status} · ${d.site ?? ''}`,
      path: `/inventory/devices/${d.id}`,
      category: 'Devices',
      icon: Server,
      keywords: join(d.id, d.hostname, d.ip, d.status, d.site, d.vendor, d.model, d.location, d.type, d.os, ...(d.tags ?? [])),
    });
  }

  for (const a of data.alerts ?? []) {
    items.push({
      id: `alert-${a.id}`,
      label: a.title,
      subtitle: `${a.device} · ${a.severity} · ${a.status}`,
      path: `/monitoring/alerts`,
      category: 'Alerts',
      icon: Bell,
      keywords: join(a.id, a.title, a.description, a.device, a.deviceIp, a.site, a.category, a.severity, a.status),
    });
  }

  for (const j of data.jobs ?? []) {
    items.push({
      id: `job-${j.id}`,
      label: j.name,
      subtitle: `${j.type} · ${j.status}`,
      path: '/operations/scheduler',
      category: 'Jobs',
      icon: Calendar,
      keywords: join(j.id, j.name, j.type, j.description, j.frequency, j.status, j.owner),
    });
  }

  for (const l of data.logs ?? []) {
    items.push({
      id: `log-${l.id}`,
      label: (l.message ?? l.level ?? 'Log entry').slice(0, 80),
      subtitle: `${l.source ?? ''} · ${l.level ?? ''}`,
      path: '/logs/syslog',
      category: 'Logs',
      icon: FileText,
      keywords: join(String(l.id), l.message, l.source, l.sourceIp, l.level, l.facility),
    });
  }

  for (const a of data.assets ?? []) {
    items.push({
      id: `asset-${a.id}`,
      label: a.name,
      subtitle: `${a.category ?? ''} · ${a.status ?? ''}`,
      path: '/inventory/assets',
      category: 'Assets',
      icon: HardDrive,
      keywords: join(a.id, a.name, a.owner, a.category, a.status),
    });
  }

  for (const u of data.users ?? []) {
    items.push({
      id: `user-${u.id}`,
      label: u.name,
      subtitle: `${u.email} · ${u.role}`,
      path: '/settings',
      category: 'Users',
      icon: Users,
      keywords: join(String(u.id), u.name, u.email, u.role, u.status),
    });
  }

  return items;
}

export function filterSearchResults(items: SearchResult[], query: string, limit = 12): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.filter(i => i.category === 'Pages').slice(0, 8);

  const scored = items
    .map(item => {
      const label = item.label.toLowerCase();
      const subtitle = (item.subtitle ?? '').toLowerCase();
      const keywords = item.keywords;
      let score = 0;
      if (label === q) score += 100;
      else if (label.startsWith(q)) score += 80;
      else if (label.includes(q)) score += 60;
      if (subtitle.includes(q)) score += 40;
      if (keywords.includes(q)) score += 30;
      // Word-boundary bonus
      if (keywords.split(/\s+/).some(w => w.startsWith(q))) score += 20;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.item);
}
