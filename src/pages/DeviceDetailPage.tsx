import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Server, MapPin, Clock, Tag, Shield,
  AlertTriangle, RefreshCw, Loader2, Pencil, X, Check, Trash2,
} from 'lucide-react';
import { timeAgo, getSeverityColor } from '../lib/utils';
import { devicesApi, alertsApi } from '../lib/api';
import { showToast } from '../components/Toast';
import { can } from '../lib/permissions';

export default function DeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [device, setDevice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deviceAlerts, setDeviceAlerts] = useState<any[]>([]);

  const fetchDevice = () => {
    if (!id) return;
    setLoading(true);
    devicesApi.get(id)
      .then(data => {
        setDevice(data);
        return alertsApi.list().then(res =>
          setDeviceAlerts(res.data.filter((a: any) => a.device === data.hostname))
        );
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDevice(); }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 size={32} className="text-blue-400 animate-spin" />
        <p className="text-slate-400 text-sm">Loading device details…</p>
      </div>
    );
  }

  if (notFound || !device) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Server size={40} className="text-slate-600" />
        <p className="text-slate-400 text-sm">Device not found.</p>
        <button onClick={() => navigate('/inventory/devices')} className="text-blue-400 text-sm hover:underline flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Inventory
        </button>
      </div>
    );
  }

  const tags: string[] = Array.isArray(device.tags)
    ? (typeof device.tags[0] === 'string' ? device.tags : [])
    : [];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Breadcrumb / back */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/inventory/devices')}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={16} /> Device Inventory
        </button>
        <span className="text-slate-600">/</span>
        <span className="text-sm text-slate-300">{device.hostname}</span>
      </div>

      {/* Header card */}
      <div className="glass rounded-2xl p-6 border border-white/8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
              {device.type === 'camera' ? '📷' : device.type === 'router' ? '⬡' : device.type === 'switch' ? '⬢' : device.type === 'server' ? '☰' : device.type === 'firewall' ? '⬛' : '🖥️'}
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-white">{device.hostname}</h1>
                <div className="flex items-center gap-1.5">
                  <span className={`status-dot ${device.status}`} />
                  <span className={`text-sm font-medium ${device.status === 'online' ? 'text-emerald-400' : device.status === 'offline' ? 'text-red-400' : 'text-amber-400'}`}>
                    {device.status?.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                <span className="font-mono text-blue-400">{device.ip}</span>
                <span>·</span><span>{device.vendor}</span>
                {device.location && <><span>·</span><span className="flex items-center gap-1"><MapPin size={12} />{device.location}</span></>}
                {device.uptime && <><span>·</span><span className="flex items-center gap-1"><Clock size={12} />Up {device.uptime}</span></>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {can('devices.edit') && (
              <button onClick={() => setIsEditOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-blue-400 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-all">
                <Pencil size={13} /> Edit Device
              </button>
            )}
            {can('devices.poll') && (
              <button onClick={() => { 
                devicesApi.poll(device.id)
                  .then((res: any) => {
                    setDevice(res.device);
                    showToast(`Polled ${device.hostname} — ${res.reachable ? 'Reachable' : 'Unreachable'}`, res.reachable ? 'success' : 'error');
                  })
                  .catch(() => showToast('Poll failed', 'error')); 
              }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-300 border border-white/10 hover:bg-white/6 transition-all">
                <RefreshCw size={13} /> Poll Now
              </button>
            )}
            {can('devices.delete') && (
              <button onClick={() => setIsDeleteOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all">
                <Trash2 size={13} /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/5 text-slate-400 text-[11px] border border-white/8">
                <Tag size={10} /> {tag}
              </span>
            ))}
          </div>
        )}

        {/* Extra info row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-5 pt-5 border-t border-white/6">
          {[
            { label: 'Site', value: device.site ?? '—' },
            { label: 'Type', value: device.type ?? '—' },
            { label: 'Interfaces', value: device.interfaces ?? '—' },
            { label: 'Last Seen', value: device.lastSeen ? timeAgo(device.lastSeen) : 'Unknown' },
          ].map(item => (
            <div key={item.label}>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">{item.label}</div>
              <div className="text-sm font-medium text-slate-200">{item.value}</div>
            </div>
          ))}

          {/* Real Uptime % */}
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Uptime %</div>
            {(() => {
              const total  = device.totalPolls  ?? 0;
              const online = device.onlinePolls ?? 0;
              if (total === 0) return <div className="text-xs text-slate-600">No data yet</div>;
              const upPct   = ((online / total) * 100).toFixed(2);
              const downPct = (((total - online) / total) * 100).toFixed(2);
              const upNum   = parseFloat(upPct);
              const upColor = '#10b981'; // Always green for uptime
              const upTextColor = 'text-emerald-400'; // Always green for uptime text
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
                    <span className={upTextColor}>{upPct}% up</span>
                    <span className="text-red-400">{downPct}% dn</span>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-white/5">
                    <div style={{ width: `${upNum}%`, background: upColor }} />
                    <div style={{ width: `${parseFloat(downPct)}%` }} className="bg-red-500/70" />
                  </div>
                  <div className="text-[10px] text-slate-500">{total.toLocaleString()} polls total</div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>


      {/* Bottom row: Events */}
      <div className="glass rounded-2xl p-5 border border-white/8">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={15} className="text-red-400" />
          <span className="text-sm font-semibold text-white">Recent Events</span>
        </div>
        {deviceAlerts.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <Shield size={24} className="mx-auto mb-2 opacity-30" />
            No active alerts for this device
          </div>
        ) : (
          <div className="space-y-2">
            {deviceAlerts.map(a => (
              <div key={a.id} className="flex gap-3 py-2 border-b border-white/4 last:border-0">
                <span className={`badge ${getSeverityColor(a.severity)} shrink-0 self-start mt-0.5`}>{a.severity}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{a.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{a.description}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{timeAgo(a.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Device Modal */}
      <AnimatePresence>
        {isEditOpen && (
          <EditDeviceModal
            device={device}
            onClose={() => setIsEditOpen(false)}
            onSaved={() => { setIsEditOpen(false); fetchDevice(); }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {isDeleteOpen && (
          <DeleteConfirmModal
            device={device}
            onClose={() => setIsDeleteOpen(false)}
            onDeleted={() => navigate('/inventory/devices')}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ device, onClose, onDeleted }: { device: any; onClose: () => void; onDeleted: () => void }) {
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const isMatch = confirm === device.hostname;

  const handleDelete = async () => {
    if (!isMatch) return;
    setLoading(true);
    try {
      await devicesApi.delete(device.id);
      onDeleted();
    } catch {
      showToast('Failed to delete device.', 'error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-[#04080f]/80 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass shadow-glass rounded-2xl border border-red-500/20 w-full max-w-md p-6 relative z-10"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>

        {/* Icon + title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
            <Trash2 size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Delete Device</h2>
            <p className="text-xs text-slate-400">This action is <span className="text-red-400 font-medium">permanent</span> and cannot be undone.</p>
          </div>
        </div>

        {/* Device info pill */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/15 mb-5">
          <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-lg">
            {device.type === 'camera' ? '📷' : device.type === 'server' ? '☰' : device.type === 'router' ? '⬡' : '🖥️'}
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{device.hostname}</div>
            <div className="text-xs font-mono text-slate-400">{device.ip} · {device.type}</div>
          </div>
        </div>

        {/* Confirmation input */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-slate-400 mb-2">
            Type <span className="font-mono text-white bg-white/10 px-1.5 py-0.5 rounded">{device.hostname}</span> to confirm:
          </label>
          <input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder={device.hostname}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono outline-none focus:border-red-500/50 transition-colors"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-all">
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={!isMatch || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Trash2 size={14} />
            {loading ? 'Deleting…' : 'Delete Device'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Edit Device Modal ─────────────────────────────────────────────────────────
function EditDeviceModal({ device, onClose, onSaved }: { device: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    hostname: device.hostname ?? '',
    ip: device.ip ?? '',
    type: device.type ?? 'server',
    vendor: device.vendor ?? '',
    model: device.model ?? '',
    os: device.os ?? '',
    location: device.location ?? '',
    site: device.site ?? '',
    status: device.status ?? 'online',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await devicesApi.update(device.id, form);
      setSuccess(true);
      setTimeout(onSaved, 600);
    } catch (err) {
      showToast('Failed to save changes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fields: { key: string; label: string; placeholder: string; mono?: boolean }[] = [
    { key: 'hostname', label: 'Hostname', placeholder: 'e.g. web-srv-01' },
    { key: 'ip', label: 'IP Address', placeholder: '192.168.1.1', mono: true },
    { key: 'vendor', label: 'Direction', placeholder: 'e.g. Northbound' },
    { key: 'location', label: 'Location', placeholder: 'e.g. Rack 42, DC-01' },
    { key: 'site', label: 'Site', placeholder: 'e.g. SITE-MAIN' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-[#04080f]/80 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass shadow-glass rounded-2xl border border-white/10 w-full max-w-lg p-6 relative z-10"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Pencil size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Edit Device</h2>
            <p className="text-xs text-slate-400">Update details for <span className="text-blue-400 font-mono">{device.hostname}</span></p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-400 mb-1">{f.label}</label>
                <input
                  value={(form as any)[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={`w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 transition-colors ${
                    f.mono ? 'font-mono' : ''
                  }`}
                />
              </div>
            ))}

            {/* Type select */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Device Type</label>
              <select
                value={form.type}
                onChange={e => set('type', e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
              >
                {['server','router','switch','firewall','storage','ap','load-balancer','camera'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Status select */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50"
              >
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="warning">Warning</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-all">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all ${
                success ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500'
              } disabled:opacity-70`}
            >
              {success ? <><Check size={14} /> Saved!</> : loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
