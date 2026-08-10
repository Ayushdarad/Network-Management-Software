import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Server, Search, Filter, Grid, List, MapPin,
  Wifi, WifiOff, AlertTriangle, HelpCircle, ExternalLink, ChevronRight, Plus, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { devicesApi } from '../lib/api';
import { showToast } from '../components/Toast';
import { can } from '../lib/permissions';

const typeColor: Record<string, string> = {
  router: 'bg-blue-500/15 text-blue-400', switch: 'bg-cyan-500/15 text-cyan-400',
  server: 'bg-indigo-500/15 text-indigo-400', firewall: 'bg-red-500/15 text-red-400',
  'ap': 'bg-emerald-500/15 text-emerald-400', 'load-balancer': 'bg-purple-500/15 text-purple-400',
  storage: 'bg-amber-500/15 text-amber-400', camera: 'bg-slate-500/15 text-slate-300',
};

const vendorEmoji: Record<string, string> = {
  Cisco: '🔵', Juniper: '🟢', 'Palo Alto': '🔴', Dell: '🔷', HPE: '🟩', F5: '🟠', NetApp: '🟡', Huawei: '🔶', Fortinet: '🟥',
};

function StatusIcon({ status }: { status: string }) {
  if (status === 'online') return <Wifi size={14} className="text-emerald-400" />;
  if (status === 'offline') return <WifiOff size={14} className="text-red-400" />;
  if (status === 'warning') return <AlertTriangle size={14} className="text-amber-400" />;
  return <HelpCircle size={14} className="text-slate-500" />;
}

function DeviceCard({ device, onClick }: { device: any; onClick: () => void }) {
  return (
    <motion.div whileHover={{ y: -3, scale: 1.01 }} onClick={onClick}
      className="glass rounded-2xl p-5 border border-white/8 hover:border-white/16 cursor-pointer transition-all group flex flex-col"
      style={{ height: '210px' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl">
          {vendorEmoji[device.vendor] ?? '🖥️'}
        </div>
        <div className="flex items-center gap-1.5">
          <StatusIcon status={device.status} />
          <span className={`status-dot ${device.status}`} />
        </div>
      </div>
      <div className="mb-1">
        <div className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors truncate">{device.hostname}</div>
        <div className="text-xs font-mono text-slate-400">{device.ip}</div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`badge text-[10px] ${typeColor[device.type] ?? 'badge-unknown'}`}>{device.type}</span>
        <span className="text-[10px] text-slate-500">{device.vendor}</span>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-0">
        <MapPin size={11} /> {device.location || <span className="italic opacity-50">No location</span>}
      </div>
    </motion.div>
  );
}


function DeviceRow({ device, onClick }: { device: any; onClick: () => void }) {
  return (
    <tr onClick={onClick} className="cursor-pointer">
      {/* Status */}
      <td style={{ width: '70px', whiteSpace: 'nowrap' }}>
        <div className="flex items-center gap-2">
          <span className={`status-dot ${device.status}`} />
          <StatusIcon status={device.status} />
        </div>
      </td>
      {/* Hostname */}
      <td style={{ whiteSpace: 'nowrap' }}>
        <div className="font-medium text-slate-200 text-sm">{device.hostname}</div>
        <div className="text-[11px] text-slate-500">{device.site}</div>
      </td>
      {/* IP */}
      <td className="font-mono text-xs text-blue-400" style={{ whiteSpace: 'nowrap', minWidth: '130px' }}>{device.ip}</td>
      {/* Type */}
      <td style={{ whiteSpace: 'nowrap' }}>
        <span className={`badge text-[10px] ${typeColor[device.type] ?? 'badge-unknown'}`}>{device.type}</span>
      </td>
      {/* Vendor */}
      <td className="text-xs text-slate-400" style={{ whiteSpace: 'nowrap' }}>
        {vendorEmoji[device.vendor]} {device.vendor}
      </td>
      {/* Location */}
      <td className="text-xs text-slate-400">{device.location}</td>
      {/* Uptime */}
      <td style={{ whiteSpace: 'nowrap', minWidth: '110px' }}>
        {(() => {
          const total  = device.totalPolls  ?? 0;
          const online = device.onlinePolls ?? 0;
          if (total === 0) return <span className="text-slate-600 text-xs">—</span>;
          const upPct = ((online / total) * 100).toFixed(1);
          const upNum = parseFloat(upPct);
          const textColor = 'text-emerald-400';
          const color = '#10b981';
          return (
            <div className="space-y-1">
              <span className={`text-xs font-mono font-semibold ${textColor}`}>{upPct}%</span>
              <div className="h-1.5 rounded-full overflow-hidden bg-white/5 w-full">
                <div style={{ width: `${upNum}%`, background: color }} className="h-full transition-all" />
              </div>
            </div>
          );
        })()}
      </td>
      {/* Downtime */}
      <td style={{ whiteSpace: 'nowrap', minWidth: '110px' }}>
        {(() => {
          const total  = device.totalPolls  ?? 0;
          const online = device.onlinePolls ?? 0;
          if (total === 0) return <span className="text-slate-600 text-xs">—</span>;
          const downPct = (((total - online) / total) * 100).toFixed(1);
          const downNum = parseFloat(downPct);
          return (
            <div className="space-y-1">
              <span className={`text-xs font-mono font-semibold ${downNum > 5 ? 'text-red-400' : 'text-slate-400'}`}>{downPct}%</span>
              <div className="h-1.5 rounded-full overflow-hidden bg-white/5 w-full">
                <div style={{ width: `${downNum}%` }} className="h-full bg-red-500/70 transition-all" />
              </div>
            </div>
          );
        })()}
      </td>
      {/* Arrow */}
      <td style={{ width: '40px' }}>
        <button onClick={onClick} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
          <ChevronRight size={15} />
        </button>
      </td>
    </tr>
  );
}

export default function InventoryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [devices, setDevices] = useState<any[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Pre-apply status filter from URL query param (e.g. ?status=online)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const s = params.get('status');
    if (s) setStatusFilter(s);
  }, [location.search]);

  const fetchDevices = () => {
    devicesApi.list().then(res => setDevices(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const filtered = devices.filter(d => {
    if (typeFilter !== 'all' && d.type !== typeFilter) return false;
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (search && !d.hostname.toLowerCase().includes(search.toLowerCase()) && !d.ip.includes(search)) return false;
    return true;
  });

  const counts = {
    total: devices.length,
    online: devices.filter(d => d.status === 'online').length,
    offline: devices.filter(d => d.status === 'offline').length,
    warning: devices.filter(d => d.status === 'warning').length,
  };

  return (
    <div className="space-y-5 animate-fade-in relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Device Inventory</h1>
          <p className="text-sm text-slate-500">{counts.total} devices across all sites</p>
        </div>
        {can('devices.create') && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/25"
          >
            <Plus size={16} /> Add Device
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: counts.total, color: 'text-white', bg: 'border-t-blue-500' },
          { label: 'Online', value: counts.online, color: 'text-emerald-400', bg: 'border-t-emerald-500' },
          { label: 'Offline', value: counts.offline, color: 'text-red-400', bg: 'border-t-red-500' },
          { label: 'Warning', value: counts.warning, color: 'text-amber-400', bg: 'border-t-amber-500' },
        ].map(s => (
          <div key={s.label} className={`glass rounded-xl p-3 border border-white/8 border-t-2 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-52 bg-white/4 border border-white/8 rounded-xl px-3 py-2">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hostname or IP..."
            className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer">
          <option value="all">All Types</option>
          {['router', 'switch', 'server', 'firewall', 'ap', 'load-balancer', 'storage', 'camera'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer">
          <option value="all">All Statuses</option>
          {['online', 'offline', 'warning', 'unknown'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center rounded-xl border border-white/8 overflow-hidden">
          <button onClick={() => setView('grid')} className={cn('p-2 transition-all', view === 'grid' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:text-white')}><Grid size={16} /></button>
          <button onClick={() => setView('list')} className={cn('p-2 transition-all', view === 'list' ? 'bg-blue-600/20 text-blue-400' : 'text-slate-500 hover:text-white')}><List size={16} /></button>
        </div>
      </div>

      {/* Content */}
      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d, i) => (
            <motion.div key={d.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <DeviceCard device={d} onClick={() => navigate(`/inventory/devices/${d.id}`)} />
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="glass rounded-2xl border border-white/8 overflow-hidden">
          <table className="nms-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '70px' }} />
              <col style={{ width: '150px' }} />
              <col style={{ width: '130px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '105px' }} />
              <col style={{ width: '105px' }} />
              <col style={{ width: '44px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Status</th>
                <th>Hostname</th>
                <th>IP Address</th>
                <th>Type</th>
                <th>Direction</th>
                <th>Location</th>
                <th style={{ color: '#34d399' }}>Uptime</th>
                <th style={{ color: '#f87171' }}>Downtime</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => (
                <DeviceRow key={d.id} device={d} onClick={() => navigate(`/inventory/devices/${d.id}`)} />
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-16 text-center text-slate-500">
              <Server size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No devices match your filters</p>
            </div>
          )}
        </div>
      )}

      {/* Add Device Modal */}
      <AnimatePresence>
        {isAddOpen && <AddDeviceModal onClose={() => setIsAddOpen(false)} onAdded={() => { setIsAddOpen(false); fetchDevices(); }} />}
      </AnimatePresence>
    </div>
  );
}

function AddDeviceModal({ onClose, onAdded }: { onClose: () => void, onAdded: () => void }) {
  const [form, setForm] = useState({
    hostname: '', ip: '', type: 'server', vendor: 'Generic', model: 'Unknown', location: '', site: 'UER II', status: 'online', os: 'Linux'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await devicesApi.create({
        ...form,
        cpu: 0, memory: 0, disk: 0, uptime: '0d 0h', interfaces: 2
      });
      onAdded();
    } catch (err) {
      console.error(err);
      showToast('Failed to add device', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        className="absolute inset-0 bg-[#04080f]/80 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass shadow-glass rounded-2xl border border-white/10 w-full max-w-lg p-6 relative z-10"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Server size={20} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Add New Device</h2>
            <p className="text-xs text-slate-400">Register a new asset to monitor in NMS.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Hostname *</label>
              <input required value={form.hostname} onChange={e => setForm({ ...form, hostname: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" placeholder="e.g. web-srv-01" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">IP Address *</label>
              <input required value={form.ip} onChange={e => setForm({ ...form, ip: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50 font-mono" placeholder="192.168.1.1" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Device Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50">
                <option value="server">Server</option>
                <option value="router">Router</option>
                <option value="switch">Switch</option>
                <option value="firewall">Firewall</option>
                <option value="storage">Storage</option>
                <option value="ap">Access Point</option>
                <option value="camera">Camera</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Direction</label>
              <input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" placeholder="LHS" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Location</label>
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" placeholder="0+000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Site</label>
              <input value={form.site} onChange={e => setForm({ ...form, site: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-blue-500/50" placeholder="e.g. SITE-MAIN" />
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/5 transition-all">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all">
              {loading ? 'Adding...' : 'Add Device'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
