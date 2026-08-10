import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { NavLink, useLocation } from 'react-router-dom';
import { ScrollText, Search, Filter, Download, RefreshCw, ChevronRight, AlertTriangle, Info, Server } from 'lucide-react';
import { timeAgo, formatDateTime } from '../lib/utils';
import { logsApi } from '../lib/api';

const levelColor: Record<string, string> = {
  error: 'text-red-400 bg-red-500/10 border-red-500/20',
  critical: 'text-red-500 bg-red-500/20 border-red-500/30',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  info: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  debug: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
};

const tabs = [
  { label: 'Event Timeline', path: '/logs/syslog' },
  { label: 'Audit Logs', path: '/logs/audit' },
];

export default function LogsPage() {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [logs, setLogs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(true);
  
  const activeTab = Math.max(0, tabs.findIndex(tab => location.pathname.startsWith(tab.path)));

  const fetchLogs = async () => {
    setLoading(true);
    try {
      if (activeTab === 0) {
        const res = await logsApi.list({ limit: '100' });
        setLogs(res.data || []);
      } else if (activeTab === 1) {
        const res = await logsApi.audit({ limit: '50' });
        setAuditLogs(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  // Real-time polling every 5 seconds
  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      fetchLogs();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [activeTab, isLive]);

  const filteredLogs = logs.filter(e => {
    if (levelFilter !== 'all' && e.level?.toLowerCase() !== levelFilter.toLowerCase()) return false;
    if (search && !e.message?.toLowerCase().includes(search.toLowerCase()) && !e.source?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredAudit = auditLogs.filter(e => {
    if (search && !e.action?.toLowerCase().includes(search.toLowerCase()) && !e.userName?.toLowerCase().includes(search.toLowerCase()) && !e.resource?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDownload = () => {
    let csv = '';
    let filename = '';

    if (activeTab === 0) {
      csv = 'Time,Level,Facility,Source,Message\n';
      filteredLogs.forEach(log => {
        csv += `"${log.createdAt}","${log.level}","${log.facility || ''}","${log.source}","${log.message?.replace(/"/g, '""')}"\n`;
      });
      filename = 'syslog_export.csv';
    } else {
      csv = 'Time,User,Role,Action,Resource,IP,Result,Detail\n';
      filteredAudit.forEach(log => {
        csv += `"${log.createdAt}","${log.userName || log.userId}","${log.userRole || ''}","${log.action}","${log.resource || ''}","${log.ip || ''}","${log.result}","${log.detail?.replace(/"/g, '""') || ''}"\n`;
      });
      filename = 'audit_export.csv';
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Logs & Events</h1>
          <p className="text-sm text-slate-500">Syslog, event timeline, and audit trail</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDownload}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 border border-white/10 hover:bg-white/6 transition-all">
            <Download size={13} /> Export CSV
          </button>
          <button onClick={fetchLogs}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 border border-white/10 hover:bg-white/6 transition-all">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/4 rounded-xl border border-white/8 w-fit">
        {tabs.map((tab, i) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === i ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-52 bg-white/4 border border-white/8 rounded-xl px-3 py-2">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..."
            className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full" />
        </div>
        {(activeTab === 0) && (
          <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
            className="bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-sm text-slate-300 outline-none cursor-pointer">
            <option value="all">All Levels</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        )}
        <button 
          onClick={() => setIsLive(!isLive)}
          className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-all ${isLive ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-slate-500 bg-white/4 border-white/8 hover:bg-white/6'}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 live-indicator' : 'bg-slate-500'}`} /> 
          {isLive ? 'Live' : 'Paused'}
        </button>
      </div>

      {activeTab === 0 && (
        <div className="glass rounded-2xl border border-white/8 overflow-hidden font-mono text-xs">
          <div className="bg-white/2 px-4 py-2 border-b border-white/6 grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-slate-600 font-sans font-semibold">
            <span className="col-span-2">Time</span>
            <span className="col-span-1">Level</span>
            <span className="col-span-1">Facility</span>
            <span className="col-span-2">Source</span>
            <span className="col-span-6">Message</span>
          </div>
          <div className="divide-y divide-white/4">
            {filteredLogs.map((entry, i) => (
              <motion.div key={entry.id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                className="grid grid-cols-12 gap-2 px-4 py-2.5 hover:bg-white/3 transition-all cursor-pointer items-start">
                <span className="col-span-2 text-slate-500 text-[11px]">{timeAgo(entry.createdAt)}</span>
                <span className={`col-span-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${levelColor[entry.level?.toLowerCase()] || levelColor.info}`}>
                  {(entry.level || 'INFO').toUpperCase()}
                </span>
                <span className="col-span-1 text-slate-600">{entry.facility || '-'}</span>
                <span className="col-span-2 text-blue-400">{entry.source}</span>
                <span className="col-span-6 text-slate-300 leading-relaxed">{entry.message}</span>
              </motion.div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="p-4 text-center text-slate-500 font-sans">No logs found matching your criteria.</div>
            )}
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div className="glass rounded-2xl border border-white/8 overflow-hidden">
          <table className="nms-table">
            <thead>
              <tr><th>Time</th><th>User</th><th>Action</th><th>Resource</th><th>IP</th><th>Result</th></tr>
            </thead>
            <tbody>
              {filteredAudit.map((row, i) => (
                <tr key={row.id || i}>
                  <td className="font-mono text-xs text-slate-400 whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                  <td className="font-medium text-blue-400 text-xs">
                    {row.userName || `User ${row.userId}`}
                    {row.userRole && <span className="ml-2 text-[10px] text-slate-500">({row.userRole})</span>}
                  </td>
                  <td className="font-mono text-xs text-slate-300">{row.action}</td>
                  <td className="text-xs max-w-[200px] truncate" title={row.resource}>{row.resource || '-'}</td>
                  <td className="font-mono text-xs text-slate-400">{row.ip || '-'}</td>
                  <td><span className={`badge ${row.result === 'success' ? 'badge-success' : 'badge-critical'}`}>{row.result}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAudit.length === 0 && (
            <div className="p-4 text-center text-slate-500 text-sm">No audit logs found.</div>
          )}
        </div>
      )}
    </div>
  );
}
