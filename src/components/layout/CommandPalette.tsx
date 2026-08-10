import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { Search, Server, Bell, BarChart2, Network, Settings, X, ArrowRight, Clock, FileText, Database, Users, HardDrive, Calendar } from 'lucide-react';

const staticCommands = [
  { label: 'Dashboard', icon: BarChart2, path: '/dashboard', category: 'Navigation' },
  { label: 'Alerts Center', icon: Bell, path: '/monitoring/alerts', category: 'Navigation' },
  { label: 'Hosts & Services', icon: Server, path: '/monitoring/hosts', category: 'Navigation' },
  { label: 'Device Timeline', icon: Clock, path: '/monitoring/timeline', category: 'Navigation' },
  { label: 'Host Service History', icon: Clock, path: '/monitoring/history', category: 'Navigation' },
  { label: 'Device Inventory', icon: Server, path: '/inventory/devices', category: 'Navigation' },
  { label: 'Asset Management', icon: HardDrive, path: '/inventory/assets', category: 'Navigation' },
  { label: 'Event Timeline', icon: FileText, path: '/logs/syslog', category: 'Navigation' },
  { label: 'Audit Logs', icon: FileText, path: '/logs/audit', category: 'Navigation' },
  { label: 'Scheduler', icon: Clock, path: '/operations/scheduler', category: 'Navigation' },
  { label: 'Reports', icon: BarChart2, path: '/reports', category: 'Navigation' },
  { label: 'Settings', icon: Settings, path: '/settings', category: 'Navigation' },
];

export default function CommandPalette() {
  const { setCommandPaletteOpen } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [dynamicCommands, setDynamicCommands] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    
    // Fetch live data from multiple sources
    import('../../lib/api').then(({ 
      devicesApi, 
      alertsApi, 
      jobsApi, 
      logsApi, 
      assetsApi, 
      usersApi 
    }) => {
      Promise.all([
        devicesApi.list().catch(() => ({ data: [] })),
        alertsApi.list({ status: 'active' }).catch(() => ({ data: [] })),
        jobsApi.list().catch(() => ({ data: [] })),
        logsApi.list({ limit: '20' }).catch(() => ({ data: [] })),
        assetsApi.list().catch(() => []),
        usersApi.list().catch(() => ({ data: [] })),
      ]).then(([devicesRes, alertsRes, jobsRes, logsRes, assetsRes, usersRes]) => {
        const devices = (devicesRes.data || []).map((d: any) => ({
          label: `${d.hostname} (${d.ip})`,
          icon: Server,
          path: `/inventory/devices/${d.id}`,
          category: 'Device'
        }));
        
        const alerts = (alertsRes.data || []).map((a: any) => ({
          label: a.title,
          icon: Bell,
          path: '/monitoring/alerts',
          category: 'Alert'
        }));

        const jobs = (jobsRes.data || []).map((j: any) => ({
          label: j.name,
          icon: Clock,
          path: '/operations/scheduler',
          category: 'Scheduled Job'
        }));

        const logs = (logsRes.data || []).slice(0, 10).map((l: any) => ({
          label: l.message || l.level,
          icon: FileText,
          path: '/logs/syslog',
          category: 'Log Entry'
        }));

        const assets = (assetsRes || []).map((a: any) => ({
          label: a.name || a.assetId,
          icon: HardDrive,
          path: '/inventory/assets',
          category: 'Asset'
        }));

        const users = (usersRes.data || []).map((u: any) => ({
          label: u.name,
          icon: Users,
          path: '/settings',
          category: 'User'
        }));

        setDynamicCommands([...devices, ...alerts, ...jobs, ...logs, ...assets, ...users]);
      });
    });
  }, []);

  const allCommands = [...staticCommands, ...dynamicCommands];

  const filtered = allCommands.filter(c =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    setCommandPaletteOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && filtered[selected]) handleSelect(filtered[selected].path);
    if (e.key === 'Escape') setCommandPaletteOpen(false);
  };

  const grouped = filtered.reduce<Record<string, typeof filtered>>((acc, cmd) => {
    (acc[cmd.category] = acc[cmd.category] || []).push(cmd);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4" onClick={() => setCommandPaletteOpen(false)}>
      <div className="absolute inset-0 bg-black/60" />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: -12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -12 }}
        transition={{ duration: 0.15 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-xl glass shadow-glass rounded-2xl overflow-hidden z-10"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search devices, pages, alerts..."
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
          <button onClick={() => setCommandPaletteOpen(false)} className="text-slate-500 hover:text-white">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500 text-sm">No results for "{query}"</div>
          ) : Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{cat}</div>
              {items.map((cmd, i) => {
                const globalIdx = filtered.indexOf(cmd);
                return (
                  <button
                    key={i}
                    onClick={() => handleSelect(cmd.path)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all ${globalIdx === selected ? 'bg-blue-500/15 text-white' : 'text-slate-300 hover:bg-white/5'}`}
                  >
                    <cmd.icon size={15} className={globalIdx === selected ? 'text-blue-400' : 'text-slate-500'} />
                    <span className="flex-1 text-left">{cmd.label}</span>
                    {globalIdx === selected && <ArrowRight size={14} className="text-blue-400" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="border-t border-white/6 px-4 py-2 flex gap-4 text-[11px] text-slate-600">
          <span><kbd className="font-mono bg-white/6 px-1.5 py-0.5 rounded">↑↓</kbd> Navigate</span>
          <span><kbd className="font-mono bg-white/6 px-1.5 py-0.5 rounded">Enter</kbd> Select</span>
          <span><kbd className="font-mono bg-white/6 px-1.5 py-0.5 rounded">Esc</kbd> Close</span>
        </div>
      </motion.div>
    </div>
  );
}
