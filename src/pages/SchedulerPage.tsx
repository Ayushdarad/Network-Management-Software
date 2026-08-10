import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Play, Pause, RefreshCw, Plus, Trash2, X, Pencil,
  CheckCircle2, XCircle, Clock, Loader2, History, ExternalLink,
  Filter, Search,
} from 'lucide-react';
import { jobsApi, devicesApi, getCurrentUser } from '../lib/api';
import { cn, getJobStatusColor, formatDateTime } from '../lib/utils';
import { showToast } from '../components/Toast';
import { can, canAny } from '../lib/permissions';
import { getSharedSocket } from '../context/AppContext';
import type { Job } from '../data/mockJobs';
import {
  JOB_TYPES, JOB_FREQUENCIES, encodeTarget, decodeTarget, formatTargetLabel,
  type TargetScope,
} from '../lib/jobTargets';

const statusIcon: Record<string, React.ElementType> = {
  success: CheckCircle2,
  failed: XCircle,
  running: Loader2,
  paused: Pause,
  scheduled: Clock,
};

interface JobFormProps {
  job?: Job | null;
  devices: any[];
  sites: string[];
  onClose: () => void;
  onSaved: () => void;
}

function JobFormModal({ job, devices, sites, onClose, onSaved }: JobFormProps) {
  const isEdit = !!job;
  const decoded = decodeTarget(job?.targetDevice);
  const user = getCurrentUser();

  const [name, setName] = useState(job?.name ?? '');
  const [type, setType] = useState(job?.type ?? JOB_TYPES[0]);
  const [frequency, setFrequency] = useState(job?.frequency ?? JOB_FREQUENCIES[4]);
  const [cron, setCron] = useState(job?.cron ?? '');
  const [description, setDescription] = useState(job?.description ?? '');
  const [scope, setScope] = useState<TargetScope>(
    type === 'Device Ping Check' ? decoded.scope : 'all'
  );
  const [targetValue, setTargetValue] = useState(decoded.value ?? '');
  const [enabled, setEnabled] = useState(job?.enabled ?? true);
  const [showCron, setShowCron] = useState(!!job?.cron);
  const [saving, setSaving] = useState(false);

  const showTarget = type === 'Device Ping Check';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        frequency,
        cron: showCron && cron.trim() ? cron.trim() : null,
        description: description.trim() || undefined,
        targetDevice: showTarget ? encodeTarget(scope, targetValue) : null,
        enabled,
        status: enabled ? 'scheduled' : 'paused',
        owner: job?.owner ?? user?.name ?? user?.email ?? 'system',
      };
      if (isEdit && job) {
        await jobsApi.update(job.id, { ...job, ...payload });
        showToast('Job updated', 'success');
      } else {
        await jobsApi.create(payload);
        showToast('Job created', 'success');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Failed to save job', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-2xl border border-white/10 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">{isEdit ? 'Edit Job' : 'New Scheduled Job'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Job Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              placeholder="e.g. Branch Site Ping" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Frequency</label>
              <select value={frequency} onChange={e => setFrequency(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                {JOB_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          {showTarget && (
            <div className="space-y-2 p-3 rounded-xl bg-white/3 border border-white/8">
              <label className="text-xs text-slate-400 block">Ping Target</label>
              <div className="flex gap-2">
                {(['all', 'device', 'site'] as TargetScope[]).map(s => (
                  <button key={s} type="button" onClick={() => setScope(s)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs capitalize border transition-colors',
                      scope === s ? 'bg-blue-600/20 border-blue-500/40 text-blue-300' : 'border-white/10 text-slate-400 hover:bg-white/5',
                    )}>
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>
              {scope === 'device' && (
                <select value={targetValue} onChange={e => setTargetValue(e.target.value)} required
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                  <option value="">Select device…</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.hostname}>{d.hostname} ({d.ip})</option>
                  ))}
                </select>
              )}
              {scope === 'site' && (
                <select value={targetValue} onChange={e => setTargetValue(e.target.value)} required
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white">
                  <option value="">Select site…</option>
                  {sites.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {scope === 'all' && (
                <p className="text-[11px] text-amber-400/80">Uses poll interval from Settings when no other global ping job exists.</p>
              )}
            </div>
          )}

          <div>
            <button type="button" onClick={() => setShowCron(v => !v)}
              className="text-xs text-blue-400 hover:text-blue-300">
              {showCron ? 'Hide' : 'Show'} custom cron expression
            </button>
            {showCron && (
              <input value={cron} onChange={e => setCron(e.target.value)}
                placeholder="e.g. */15 * * * *"
                className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none" />
            )}
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white resize-none focus:outline-none" />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded" />
            Enabled on save
          </label>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-xl text-sm text-slate-300 border border-white/10 hover:bg-white/5">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50">
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function HistoryDrawer({ job, onClose }: { job: Job; onClose: () => void }) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobsApi.history(job.id)
      .then(r => setHistory(r.data ?? []))
      .catch(() => showToast('Failed to load history', 'error'))
      .finally(() => setLoading(false));
  }, [job.id]);

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col border-l border-white/10"
      style={{ background: 'rgba(7,13,26,0.98)' }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <History size={16} className="text-cyan-400" /> Run History
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{job.name}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12 text-slate-500 text-sm">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading…
          </div>
        ) : history.length === 0 ? (
          <p className="text-center text-sm text-slate-500 py-12">No run history yet</p>
        ) : history.map(entry => (
          <div key={entry.id} className="p-3 rounded-xl bg-white/3 border border-white/6">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-[10px] uppercase font-semibold',
                entry.level === 'error' ? 'text-red-400' : 'text-emerald-400')}>{entry.level}</span>
              <span className="text-[10px] text-slate-500">{formatDateTime(entry.createdAt)}</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{entry.message}</p>
          </div>
        ))}
      </div>
      <div className="p-4 border-t border-white/8">
        <button onClick={() => navigate('/logs/syslog')}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm text-blue-400 border border-blue-500/30 hover:bg-blue-500/10">
          <ExternalLink size={14} /> View all in Event Timeline
        </button>
      </div>
    </motion.div>
  );
}

function KPICard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-xl p-4 border border-white/8">
      <div className={cn('text-2xl font-bold font-mono', color)}>{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function SchedulerPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [formJob, setFormJob] = useState<Job | null | undefined>(undefined);
  const [historyJob, setHistoryJob] = useState<Job | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const sites = useMemo(
    () => [...new Set(devices.map(d => d.site).filter(Boolean))].sort(),
    [devices],
  );

  const fetchJobs = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await jobsApi.list();
      setJobs(res.data ?? []);
    } catch {
      showToast('Failed to load jobs', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    devicesApi.list().then(r => setDevices(r.data ?? [])).catch(() => {});
  }, [fetchJobs]);

  // WebSocket live updates
  useEffect(() => {
    const socket = getSharedSocket();
    if (!socket) return;
    const onUpdate = (patch: { jobId: string; status?: string; progress?: number; duration?: string; enabled?: boolean }) => {
      setJobs(prev => prev.map(j => j.id === patch.jobId ? { ...j, ...patch } as Job : j));
    };
    const onProgress = ({ jobId, progress }: { jobId: string; progress: number }) => {
      setJobs(prev => prev.map(j => j.id === jobId ? { ...j, progress, status: 'running' as const } : j));
    };
    socket.on('job:update', onUpdate);
    socket.on('job:progress', onProgress);
    return () => {
      socket.off('job:update', onUpdate);
      socket.off('job:progress', onProgress);
    };
  }, []);

  const stats = useMemo(() => ({
    enabled: jobs.filter(j => j.enabled).length,
    running: jobs.filter(j => j.status === 'running').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    paused: jobs.filter(j => j.status === 'paused' || !j.enabled).length,
  }), [jobs]);

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      if (statusFilter !== 'all' && j.status !== statusFilter && !(statusFilter === 'paused' && !j.enabled)) return false;
      if (typeFilter !== 'all' && j.type !== typeFilter) return false;
      if (search && !j.name.toLowerCase().includes(search.toLowerCase()) &&
          !j.type.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [jobs, statusFilter, typeFilter, search]);

  const canManage = can('jobs.manage');
  const canRun = canAny('jobs.run', 'jobs.manage');

  const runAction = async (fn: () => Promise<void>, successMsg: string) => {
    try {
      await fn();
      showToast(successMsg, 'success');
      setTimeout(fetchJobs, 800);
    } catch (err: any) {
      showToast(err.message || 'Action failed', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar size={20} className="text-cyan-400" />
            Job Scheduler
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">ICMP ping checks, log cleanup, and uptime reports</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchJobs}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 border border-white/10 hover:bg-white/6">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          {canManage && (
            <button onClick={() => setFormJob(null)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white">
              <Plus size={14} /> New Job
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard label="Enabled" value={stats.enabled} color="text-emerald-400" />
        <KPICard label="Running" value={stats.running} color="text-blue-400" />
        <KPICard label="Failed" value={stats.failed} color="text-red-400" />
        <KPICard label="Paused" value={stats.paused} color="text-amber-400" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 bg-white/3">
          <Search size={13} className="text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs…"
            className="bg-transparent text-sm text-white outline-none w-36" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter size={12} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-slate-300">
            <option value="all">All statuses</option>
            <option value="running">Running</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="scheduled">Scheduled</option>
            <option value="paused">Paused</option>
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-slate-300">
            <option value="all">All types</option>
            {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/8 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading jobs…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Calendar size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">{jobs.length === 0 ? 'No jobs configured' : 'No jobs match filters'}</p>
          </div>
        ) : (
          <table className="nms-table min-w-[900px]">
            <thead>
              <tr>
                <th>Status</th>
                <th>Name</th>
                <th>Type</th>
                <th>Target</th>
                <th>Frequency</th>
                <th>Last Run</th>
                <th>Next Run</th>
                <th>Duration</th>
                {(canRun || canManage) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(job => {
                const Icon = statusIcon[job.status] ?? Clock;
                const busy = actionId === job.id;
                return (
                  <tr key={job.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <Icon size={14} className={cn(getJobStatusColor(job.status), job.status === 'running' && 'animate-spin')} />
                        <span className={cn('text-xs capitalize', getJobStatusColor(job.status))}>{job.status}</span>
                      </div>
                      {job.progress != null && job.status === 'running' && (
                        <div className="w-20 h-1 bg-white/6 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-blue-500 transition-all" style={{ width: `${job.progress}%` }} />
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="text-sm font-medium text-white">{job.name}</div>
                      {job.description && <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{job.description}</div>}
                      {job.owner && <div className="text-[10px] text-slate-600">by {job.owner}</div>}
                    </td>
                    <td className="text-xs text-slate-400">{job.type}</td>
                    <td className="text-xs text-slate-400">
                      {job.type === 'Device Ping Check' ? formatTargetLabel(job.targetDevice) : '—'}
                    </td>
                    <td className="text-xs text-slate-400">{job.frequency}</td>
                    <td className="text-xs font-mono text-slate-400">{job.lastRun ? formatDateTime(job.lastRun) : '—'}</td>
                    <td className="text-xs font-mono text-slate-400">{job.nextRun ? formatDateTime(job.nextRun) : '—'}</td>
                    <td className="text-xs font-mono text-slate-400">{job.duration ?? '—'}</td>
                    {(canRun || canManage) && (
                      <td>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => setHistoryJob(job)} title="History"
                            className="p-1.5 rounded-lg text-slate-400 hover:bg-white/5">
                            <History size={14} />
                          </button>
                          {canRun && (
                            <button onClick={() => { setActionId(job.id); runAction(() => jobsApi.run(job.id), 'Job started').finally(() => setActionId(null)); }}
                              disabled={busy || job.status === 'running'} title="Run now"
                              className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40">
                              <Play size={14} />
                            </button>
                          )}
                          {canManage && (
                            <>
                              {job.enabled ? (
                                <button onClick={() => { setActionId(job.id); runAction(() => jobsApi.pause(job.id), 'Job paused').finally(() => setActionId(null)); }}
                                  disabled={busy} title="Pause"
                                  className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 disabled:opacity-40">
                                  <Pause size={14} />
                                </button>
                              ) : (
                                <button onClick={() => { setActionId(job.id); runAction(() => jobsApi.resume(job.id), 'Job resumed').finally(() => setActionId(null)); }}
                                  disabled={busy} title="Resume"
                                  className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40">
                                  <Play size={14} />
                                </button>
                              )}
                              <button onClick={() => setFormJob(job)} title="Edit"
                                className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => {
                                if (!confirm('Delete this job?')) return;
                                setActionId(job.id);
                                runAction(() => jobsApi.delete(job.id), 'Job deleted').finally(() => setActionId(null));
                              }} disabled={busy} title="Delete"
                                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 disabled:opacity-40">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {formJob !== undefined && (
          <JobFormModal
            job={formJob}
            devices={devices}
            sites={sites}
            onClose={() => setFormJob(undefined)}
            onSaved={fetchJobs}
          />
        )}
        {historyJob && (
          <HistoryDrawer job={historyJob} onClose={() => setHistoryJob(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
