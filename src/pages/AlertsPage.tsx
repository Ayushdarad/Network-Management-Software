import { useState } from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Bell, CheckCircle,
  Search, RefreshCw, User,
  MoreHorizontal, ExternalLink, X, Info
} from 'lucide-react';
import { type Alert } from '../data/mockAlerts';
import { alertsApi } from '../lib/api';
import { getSeverityColor, timeAgo, formatDateTime } from '../lib/utils';
import { cn } from '../lib/utils';
import { showToast } from '../components/Toast';
import { can } from '../lib/permissions';

const severityIcon = { critical: AlertTriangle, warning: AlertTriangle, info: Info };

function AlertDetailDrawer({ alert, onClose, onAcknowledge, onResolve }: {
  alert: Alert; onClose: () => void;
  onAcknowledge: (id: string) => void;
  onResolve: (id: string) => void;
}) {
  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed right-0 top-0 h-full w-[480px] z-40 flex flex-col border-l border-white/8 shadow-2xl"
      style={{ background: 'rgba(7,13,26,0.97)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-3">
          <span className={`badge ${getSeverityColor(alert.severity)}`}>{alert.severity}</span>
          <span className="text-sm font-semibold text-white">{alert.id}</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* Title */}
        <div>
          <h2 className="text-lg font-bold text-white mb-1">{alert.title}</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{alert.description}</p>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Device', value: alert.device },
            { label: 'IP Address', value: alert.deviceIp },
            { label: 'Site', value: alert.site },
            { label: 'Category', value: alert.category },
            { label: 'First Seen', value: formatDateTime(alert.createdAt) },
            { label: 'Duration', value: alert.status !== 'resolved' ? timeAgo(alert.createdAt) : alert.duration },
            { label: 'Occurrences', value: String(alert.count) },
            { label: 'Status', value: alert.status },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/3 rounded-xl p-3 border border-white/6">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
              <div className="text-sm font-medium text-white">{value}</div>
            </div>
          ))}
        </div>

        {/* Assignment */}
        {(alert.acknowledgedBy || alert.assignedTo) && (
          <div className="glass rounded-xl p-4 border border-white/8">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Assignment</div>
            {alert.acknowledgedBy && (
              <div className="flex items-center gap-2 text-sm mb-2">
                <CheckCircle size={14} className="text-emerald-400" />
                <span className="text-slate-400">Acknowledged by</span>
                <span className="text-white font-medium">{alert.acknowledgedBy}</span>
              </div>
            )}
            {alert.assignedTo && (
              <div className="flex items-center gap-2 text-sm">
                <User size={14} className="text-blue-400" />
                <span className="text-slate-400">Assigned to</span>
                <span className="text-white font-medium">{alert.assignedTo}</span>
              </div>
            )}
          </div>
        )}

        {/* RCA */}
        {alert.rca && (
          <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={14} className="text-indigo-400" />
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">AI Root Cause Analysis</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{alert.rca}</p>
          </div>
        )}

        {/* Timeline */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Incident Timeline</div>
          <div className="space-y-3">
            {[
              { time: alert.createdAt, event: 'Alert triggered', color: 'bg-red-500' },
              { time: alert.createdAt, event: 'Notification sent to NOC team', color: 'bg-blue-500' },
              ...(alert.acknowledgedBy ? [{ time: alert.updatedAt ?? alert.createdAt, event: `Acknowledged by ${alert.acknowledgedBy}`, color: 'bg-emerald-500' }] : []),
            ].map((item: any, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0 mt-1`} />
                  {i < 2 && <div className="w-px flex-1 bg-white/8 mt-1" />}
                </div>
                <div className="pb-3">
                  <div className="text-sm text-slate-300">{item.event}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatDateTime(item.time)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-white/8 p-4 flex gap-2 shrink-0">
        {can('alerts.acknowledge') && (
          <button onClick={() => onAcknowledge(alert.id)} className="flex-1 py-2 rounded-lg bg-blue-600/20 text-blue-400 text-sm font-medium hover:bg-blue-600/30 transition-all border border-blue-500/20">
            Acknowledge
          </button>
        )}
        {can('alerts.resolve') && (
          <button onClick={() => onResolve(alert.id)} className="flex-1 py-2 rounded-lg bg-emerald-600/20 text-emerald-400 text-sm font-medium hover:bg-emerald-600/30 transition-all border border-emerald-500/20">
            Resolve
          </button>
        )}
        <button onClick={onClose} className="px-3 py-2 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/8">
          <ExternalLink size={15} />
        </button>
      </div>
    </motion.div>
  );
}

export default function AlertsPage() {
  const location = useLocation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pre-apply filters from URL query params (e.g. ?severity=critical or ?status=active)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sev = params.get('severity');
    const sta = params.get('status');
    if (sev) setSeverityFilter(sev);
    if (sta) setStatusFilter(sta);
  }, [location.search]);

  useEffect(() => {
    setLoading(true);
    alertsApi.list()
      .then(res => setAlerts(res.data as Alert[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = alerts.filter(a => {
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) && !a.device.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const counts = {
    critical: alerts.filter(a => a.severity === 'critical' && a.status === 'active').length,
    warning: alerts.filter(a => a.severity === 'warning' && a.status === 'active').length,
    info: alerts.filter(a => a.severity === 'info' && a.status === 'active').length,
  };

  const updateAlert = (id: string, patch: Partial<Alert>) => {
    setAlerts(prev => prev.map(a => (a.id === id ? { ...a, ...patch } : a)));
    setSelected(prev => (prev?.id === id ? { ...prev, ...patch } : prev));
  };

  const handleRefresh = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await alertsApi.list();
      setAlerts(res.data as Alert[]);
    } catch {
      // keep existing alerts visible on error — don't wipe the list
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    const updated = await alertsApi.acknowledge(id);
    updateAlert(id, { status: updated.status, acknowledgedBy: updated.acknowledgedBy });
  };

  const handleResolve = async (id: string) => {
    const updated = await alertsApi.resolve(id);
    updateAlert(id, { status: updated.status });
  };

  const handleDelete = async (id: string) => {
    await alertsApi.delete(id);
    setAlerts(prev => prev.filter(a => a.id !== id));
    setSelected(prev => (prev?.id === id ? null : prev));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Alert Center</h1>
          <p className="text-sm text-slate-500">Monitor and manage all network alerts and incidents</p>
        </div>
        <button
          onClick={() => void handleRefresh()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 border border-white/10 hover:bg-white/6 transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Critical', count: counts.critical, color: 'border-t-red-500', badge: 'badge-critical', icon: AlertTriangle },
          { label: 'Warning', count: counts.warning, color: 'border-t-amber-500', badge: 'badge-warning', icon: Bell },
          { label: 'Info', count: counts.info, color: 'border-t-blue-500', badge: 'badge-info', icon: Info },
        ].map(({ label, count, color, icon: Icon }) => (
          <div key={label} className={`glass rounded-2xl p-4 border border-white/8 border-t-2 ${color}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-white">{count}</div>
                <div className="text-xs text-slate-400">{label} Active</div>
              </div>
              <Icon size={20} className="text-slate-500" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48 bg-white/4 border border-white/8 rounded-xl px-3 py-2">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search alerts, devices..." className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full" />
        </div>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
          className="bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer">
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-slate-400">{selectedIds.size} selected</span>
            <button onClick={() => void Promise.all([...selectedIds].map(id => handleAcknowledge(id)))} className="px-3 py-1.5 rounded-lg text-xs bg-blue-600/20 text-blue-400 border border-blue-500/20 hover:bg-blue-600/30 transition-all">Acknowledge All</button>
            <button onClick={() => void Promise.all([...selectedIds].map(id => handleResolve(id)))} className="px-3 py-1.5 rounded-lg text-xs bg-red-600/20 text-red-400 border border-red-500/20 hover:bg-red-600/30 transition-all">Resolve All</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass rounded-2xl border border-white/8 overflow-hidden">
        <table className="nms-table">
          <thead>
            <tr>
              <th className="w-8"><input type="checkbox" className="rounded" /></th>
              <th>Severity</th><th>Alert ID</th><th>Title</th><th>Device</th>
              <th>Site</th><th>Duration</th><th>Status</th><th>Time</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((alert, i) => {
              const Icon = severityIcon[alert.severity];
              return (
                <motion.tr key={alert.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelected(alert)}
                  className={cn('cursor-pointer', selectedIds.has(alert.id) && 'bg-blue-500/5')}
                >
                  <td onClick={e => { e.stopPropagation(); toggleSelect(alert.id); }}>
                    <input type="checkbox" checked={selectedIds.has(alert.id)} onChange={() => { }} className="rounded" />
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Icon size={14} className={alert.severity === 'critical' ? 'text-red-400' : alert.severity === 'warning' ? 'text-amber-400' : 'text-blue-400'} />
                      <span className={`badge ${getSeverityColor(alert.severity)}`}>{alert.severity}</span>
                    </div>
                  </td>
                  <td className="font-mono text-xs text-slate-400">{alert.id}</td>
                  <td className="font-medium text-slate-200 max-w-[200px] truncate">{alert.title}</td>
                  <td className="text-blue-400 font-mono text-xs">{alert.device}</td>
                  <td className="text-xs">{alert.site}</td>
                  <td className="font-mono text-xs text-slate-400 whitespace-nowrap">
                    {alert.status !== 'resolved'
                      ? timeAgo(alert.createdAt)          // live elapsed since outage started
                      : alert.duration                    // stored downtime on resolved alerts
                    }
                  </td>
                  <td>
                    <span className={cn('badge', alert.status === 'active' ? 'badge-critical' : alert.status === 'acknowledged' ? 'badge-warning' : 'badge-success')}>
                      {alert.status}
                    </span>
                  </td>
                  <td className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(alert.createdAt)}</td>
                  <td onClick={e => e.stopPropagation()}>
                    {can('alerts.delete') && (
                      <button onClick={() => void handleDelete(alert.id)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-all">
                        <MoreHorizontal size={15} />
                      </button>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-16 text-center text-slate-500">
            <Bell size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No alerts match your filters</p>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <div className="fixed inset-0 bg-black/40 z-30" onClick={() => setSelected(null)} />
            <AlertDetailDrawer
              alert={selected}
              onClose={() => setSelected(null)}
              onAcknowledge={(id) => void handleAcknowledge(id).then(() => { showToast(`Alert ${id} acknowledged`, 'success'); setSelected(null); })}
              onResolve={(id) => void handleResolve(id).then(() => { showToast(`Alert ${id} resolved`, 'success'); setSelected(null); })}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
