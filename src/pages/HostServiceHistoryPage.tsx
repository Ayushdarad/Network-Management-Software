import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  History, Search, Filter, AlertTriangle, Info,
  CheckCircle2, Clock, Server, RefreshCw, ChevronDown
} from 'lucide-react';
import { alertsApi, logsApi } from '../lib/api';
import { getSeverityColor, timeAgo, formatDateTime } from '../lib/utils';
import { cn } from '../lib/utils';

// ─── Unified history entry ─────────────────────────────────────
interface HistoryEntry {
  id: string;
  kind: 'alert' | 'log';
  time: string;
  host: string;
  title: string;
  detail: string;
  severity: string;
  status?: string;
  duration?: string;
}

function severityDot(severity: string) {
  if (severity === 'critical' || severity === 'error')
    return 'bg-red-400 shadow-[0_0_6px_#ef4444]';
  if (severity === 'warning') return 'bg-amber-400 shadow-[0_0_6px_#f59e0b]';
  if (severity === 'info' || severity === 'debug') return 'bg-blue-400';
  return 'bg-slate-400';
}

function badgeColor(severity: string) {
  if (severity === 'critical' || severity === 'error') return 'badge-critical';
  if (severity === 'warning') return 'badge-warning';
  return 'badge-info';
}

export default function HostServiceHistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'alert' | 'log'>('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');   // active | acknowledged | resolved | all
  const [visibleCount, setVisibleCount] = useState(50);

  const load = async () => {
    setLoading(true);
    try {
      const [alertsRes, logsRes] = await Promise.all([
        alertsApi.list(),
        logsApi.list({ limit: '300' }),
      ]);

      const alertEntries: HistoryEntry[] = alertsRes.data.map((a: any) => ({
        id:       `alert-${a.id}`,
        kind:     'alert' as const,
        time:     a.createdAt ?? a.updatedAt,
        host:     a.device,
        title:    a.title,
        detail:   a.description,
        severity: a.severity,
        status:   a.status,
        duration: a.status !== 'resolved' ? timeAgo(a.createdAt) : a.duration,
      }));

      // Build a fast lookup: host → set of alert timestamps (ms) so we can
      // suppress log entries that duplicate an alert within a 60-second window.
      const alertIndex = new Map<string, number[]>();
      for (const ae of alertEntries) {
        const t = new Date(ae.time).getTime();
        if (!alertIndex.has(ae.host)) alertIndex.set(ae.host, []);
        alertIndex.get(ae.host)!.push(t);
      }
      const isDuplicatedByAlert = (host: string, timeStr: string): boolean => {
        const times = alertIndex.get(host);
        if (!times) return false;
        const t = new Date(timeStr).getTime();
        return times.some(at => Math.abs(at - t) <= 60_000); // within 60 s
      };

      const logEntries: HistoryEntry[] = logsRes.data
        // Serialize date: logs use MySQL CURRENT_TIMESTAMP default → convert
        .map((l: any) => ({
          ...l,
          createdAt: l.createdAt instanceof Date
            ? l.createdAt.toISOString()
            : l.createdAt,
        }))
        // ── Deduplicate: drop log entries that are already represented by an alert ──
        // pingMonitor inserts both a log AND creates/resolves an alert on every
        // state change. Showing both is redundant — the alert has richer info.
        .filter((l: any) => !isDuplicatedByAlert(l.source, l.createdAt))
        .map((l: any) => ({
          id:       `log-${l.id}`,
          kind:     'log' as const,
          time:     l.createdAt,
          host:     l.source,
          title:    l.message,
          detail:   l.raw
            ? (() => { try { return JSON.stringify(JSON.parse(l.raw), null, 0); } catch { return l.raw; } })()
            : '',
          severity: l.level,
        }));

      const merged = [...alertEntries, ...logEntries].sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      );
      setEntries(merged);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = entries.filter(e => {
    if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    // Status filter only applies to alert entries (logs have no status)
    if (statusFilter !== 'all') {
      if (e.kind === 'alert' && e.status !== statusFilter) return false;
      if (e.kind === 'log' && statusFilter !== 'all') return false; // hide logs when filtering by status
    }
    if (search) {
      const q = search.toLowerCase();
      if (!e.host.toLowerCase().includes(q) && !e.title.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const visible = filtered.slice(0, visibleCount);

  const stats = {
    total:      entries.length,
    active:     entries.filter(e => e.kind === 'alert' && e.status === 'active').length,
    resolved:   entries.filter(e => e.kind === 'alert' && e.status === 'resolved').length,
    critical:   entries.filter(e => e.severity === 'critical' || e.severity === 'error').length,
  };

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <History size={20} className="text-cyan-400" />
            Host &amp; Service History
          </h1>
          <p className="text-sm text-slate-500">
            Full historical timeline of alerts and syslog events across all hosts
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 border border-white/10 hover:bg-white/6 transition-all">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Events',     value: stats.total,    color: 'text-white',        border: 'border-t-blue-500',    onClick: () => { setStatusFilter('all'); setKindFilter('all'); } },
          { label: 'Active Alerts',    value: stats.active,   color: 'text-red-400',      border: 'border-t-red-500',     onClick: () => { setStatusFilter('active'); setKindFilter('alert'); } },
          { label: 'Resolved Alerts',  value: stats.resolved, color: 'text-emerald-400',  border: 'border-t-emerald-500', onClick: () => { setStatusFilter('resolved'); setKindFilter('alert'); } },
          { label: 'Critical/Error',   value: stats.critical, color: 'text-amber-400',    border: 'border-t-amber-500',   onClick: () => { setSeverityFilter('critical'); } },
        ].map(s => (
          <div key={s.label} onClick={s.onClick}
            className={`glass rounded-xl p-4 border border-white/8 border-t-2 ${s.border} cursor-pointer hover:bg-white/4 transition-all`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-52 bg-white/4 border border-white/8 rounded-xl px-3 py-2">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search host or event..."
            className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full"
          />
        </div>
        <select
          value={kindFilter}
          onChange={e => setKindFilter(e.target.value as any)}
          className="bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="alert">Alerts only</option>
          <option value="log">Logs only</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          className="bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer"
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} events
        </span>
      </div>

      {/* Timeline */}
      <div className="glass rounded-2xl border border-white/8 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[140px_160px_1fr_90px_100px_110px] gap-4 px-5 py-3 border-b border-white/6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>Time</span>
          <span>Host</span>
          <span>Event</span>
          <span>Type</span>
          <span>Duration</span>
          <span>Severity</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500">
            <RefreshCw size={28} className="mx-auto mb-3 opacity-40 animate-spin" />
            <p className="text-sm">Loading history...</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <History size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No events match your filters</p>
          </div>
        ) : (
          <div className="divide-y divide-white/4">
            {visible.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.4) }}
                className="grid grid-cols-[140px_160px_1fr_90px_100px_110px] gap-4 px-5 py-3 hover:bg-white/3 transition-all items-start"
              >
                {/* Time */}
                <div>
                  <div className="text-xs font-mono text-slate-300 whitespace-nowrap">
                    {formatDateTime(entry.time)}
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">{timeAgo(entry.time)}</div>
                </div>

                {/* Host */}
                <div className="flex items-center gap-2 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${severityDot(entry.severity)}`} />
                  <span className="text-xs font-mono text-blue-400 truncate">{entry.host}</span>
                </div>

                {/* Event */}
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{entry.title}</div>
                  {entry.detail && (
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{entry.detail}</div>
                  )}
                  {entry.status && (
                    <span className={cn(
                      'inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium',
                      entry.status === 'active'       ? 'bg-red-500/15 text-red-400' :
                      entry.status === 'acknowledged' ? 'bg-amber-500/15 text-amber-400' :
                      'bg-emerald-500/15 text-emerald-400'
                    )}>
                      {entry.status}
                    </span>
                  )}
                </div>

                {/* Type badge */}
                <div>
                  <span className={cn(
                    'badge text-[10px]',
                    entry.kind === 'alert' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20' : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20'
                  )}>
                    {entry.kind === 'alert' ? '⚠ Alert' : '📋 Log'}
                  </span>
                </div>

                {/* Duration */}
                <div className="text-xs font-mono text-slate-400 whitespace-nowrap">
                  {entry.duration ?? '—'}
                </div>

                {/* Severity */}
                <div>
                  <span className={`badge ${badgeColor(entry.severity)} text-[10px]`}>
                    {entry.severity}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Load more */}
        {filtered.length > visibleCount && (
          <div className="border-t border-white/6 p-4 text-center">
            <button
              onClick={() => setVisibleCount(v => v + 50)}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl text-sm text-slate-300 border border-white/10 hover:bg-white/6 transition-all"
            >
              <ChevronDown size={14} />
              Load more ({filtered.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
