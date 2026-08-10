import { motion } from 'framer-motion';
import { Server, Wifi, WifiOff, AlertTriangle, Activity, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { devicesApi, alertsApi } from '../lib/api';
import { getSeverityColor, timeAgo } from '../lib/utils';

// Format a duration in seconds as "Xd Xh Xm" or "Xh Xm" or "Xm"
function fmtSecs(secs: number): string {
  if (secs <= 0) return '0m';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function HostsServicesPage() {
  const [search, setSearch] = useState('');
  const [devices, setDevices] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    devicesApi.list().then(res => setDevices(res.data)).catch(() => setDevices([]));
    alertsApi.list({ status: 'active' }).then(res => setAlerts(res.data)).catch(() => setAlerts([]));
  }, []);

  const filtered = devices.filter(d =>
    !search || d.hostname.toLowerCase().includes(search.toLowerCase()) || d.ip.includes(search)
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Hosts &amp; Services</h1>
          <p className="text-sm text-slate-500">Current status of all monitored hosts and services</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Hosts Up',      value: devices.filter(d => d.status === 'online').length,  color: 'text-emerald-400', border: 'border-t-emerald-500', icon: Wifi },
          { label: 'Hosts Down',    value: devices.filter(d => d.status === 'offline').length, color: 'text-red-400',     border: 'border-t-red-500',     icon: WifiOff },
          { label: 'Hosts Warning', value: devices.filter(d => d.status === 'warning').length, color: 'text-amber-400',   border: 'border-t-amber-500',   icon: AlertTriangle },
          { label: 'Active Alerts', value: alerts.length,                                      color: 'text-blue-400',    border: 'border-t-blue-500',    icon: Activity },
        ].map(s => (
          <div key={s.label} className={`glass rounded-xl p-4 border border-white/8 border-t-2 ${s.border}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
              <s.icon size={18} className="text-slate-600" />
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2 max-w-sm">
        <Search size={14} className="text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search hosts..."
          className="bg-transparent text-sm text-white placeholder-slate-500 outline-none flex-1" />
      </div>

      {/* Host Status Table */}
      <div className="glass rounded-2xl border border-white/8 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/6 flex items-center gap-2">
          <Server size={14} className="text-blue-400" />
          <span className="text-sm font-semibold text-white">Host Status</span>
          <span className="badge badge-info ml-auto">{filtered.length} hosts</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Server size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hosts found</p>
          </div>
        ) : (
          <table className="nms-table">
            <thead>
              <tr>
                <th>Status</th><th>Hostname</th><th>IP Address</th><th>Type</th>
                <th>Location</th><th>Uptime %</th><th>Uptime</th><th>Last Check</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((device, i) => (
                <tr key={device.id} style={{ animation: `fadeIn 0.3s ease-out ${i * 0.025}s both` }}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className={`status-dot ${device.status}`} />
                      <span className={`text-xs font-medium ${
                        device.status === 'online' ? 'text-emerald-400' :
                        device.status === 'offline' ? 'text-red-400' :
                        device.status === 'warning' ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {device.status.toUpperCase()}
                      </span>
                    </div>
                  </td>
                  <td className="font-medium text-blue-400 text-sm">{device.hostname}</td>
                  <td className="font-mono text-xs text-slate-400">{device.ip}</td>
                  <td><span className="text-xs text-slate-400">{device.type}</span></td>
                  <td className="text-xs text-slate-400">{device.location}</td>
                  {/* Uptime % */}
                  <td>
                    {(() => {
                      const total  = device.totalPolls  ?? 0;
                      const online = device.onlinePolls ?? 0;
                      if (total === 0) return <span className="text-slate-600 text-xs">—</span>;
                      const upPct   = ((online / total) * 100).toFixed(2);
                      const downPct = (((total - online) / total) * 100).toFixed(2);
                      const barColor = '#10b981';
                      const textCol  = 'text-emerald-400';
                      return (
                        <div className="min-w-[160px] space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono font-semibold">
                            <span className={textCol}>{upPct}%</span>
                            <span className="text-slate-500 text-[10px]">{downPct}% dn</span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden bg-white/6 flex">
                            <div style={{ width: `${upPct}%`, background: barColor, transition: 'width 0.6s ease' }} className="h-full rounded-l-full" />
                            <div style={{ width: `${parseFloat(downPct)}%` }} className="h-full bg-red-500/50 rounded-r-full" />
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="font-mono text-xs text-slate-300">
                    {device.status === 'online'
                      ? device.uptime
                      : device.status === 'offline'
                        ? <span className="text-red-400/70">Down</span>
                        : <span className="text-slate-600">—</span>
                    }
                  </td>
                  <td className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(device.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Service Problems */}
      <div className="glass rounded-2xl border border-white/8 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/6 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-400" />
          <span className="text-sm font-semibold text-white">Service Problems</span>
          <span className="badge badge-warning ml-auto">{alerts.length} active</span>
        </div>
        {alerts.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">No active service problems</div>
        ) : (
          <table className="nms-table">
            <thead>
              <tr><th>Severity</th><th>Host</th><th>Service</th><th>State</th><th>Duration</th><th>Info</th></tr>
            </thead>
            <tbody>
              {alerts.map((alert, i) => (
                <motion.tr key={alert.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                  <td><span className={`badge ${getSeverityColor(alert.severity)}`}>{alert.severity}</span></td>
                  <td className="font-mono text-blue-400 text-xs">{alert.device}</td>
                  <td className="text-xs font-medium text-slate-200">{alert.category}</td>
                  <td><span className="badge badge-critical">PROBLEM</span></td>
                  <td className="font-mono text-xs text-amber-300/80">
                    {alert.createdAt ? timeAgo(alert.createdAt) : alert.duration}
                  </td>
                  <td className="text-xs text-slate-400 max-w-[220px] truncate">{alert.title}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
