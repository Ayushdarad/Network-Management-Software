import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
  Server, Wifi, WifiOff, AlertTriangle, Activity,
  Plus, Radar, FileText, RefreshCw,
  TrendingUp, TrendingDown, Minus,
  Network, CheckCircle2, XCircle, Clock, ArrowRight, Lightbulb, Calendar
} from 'lucide-react';
import { devicesApi, alertsApi, jobsApi } from '../lib/api';
import { generateTimeLabels, timeAgo, getSeverityColor } from '../lib/utils';
import { cn } from '../lib/utils';

// ─── KPI Card ─────────────────────────────────────────────────
function KPICard({ title, value, icon: Icon, color, trend, sub, onClick }: {
  title: string; value: number | string; icon: React.ElementType;
  color: string; trend?: 'up' | 'down' | 'flat'; sub?: string; onClick?: () => void;
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  return (
    <div
      onClick={onClick}
      className="glass rounded-2xl p-5 cursor-pointer border border-white/8 hover:border-white/16 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-slate-500'}`}>
            <TrendIcon size={12} />
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-white mb-0.5 font-mono">{value}</div>
      <div className="text-xs text-slate-400 font-medium">{title}</div>
      {sub && <div className="text-[11px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Donut Chart ───────────────────────────────────────────────
function DonutChart({ title, data }: { title: string; data: { name: string; value: number; color: string }[] }) {
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', backgroundColor: '#111e35', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#f1f5f9' } },
    legend: { show: false },
    series: [{
      type: 'pie', radius: ['55%', '80%'], center: ['50%', '50%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: 'transparent', borderWidth: 2 },
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold', color: '#f1f5f9' } },
      data: data.map(d => ({ value: d.value, name: d.name, itemStyle: { color: d.color } }))
    }]
  };
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="glass rounded-2xl p-5 border border-white/8">
      <div className="text-sm font-semibold text-white mb-3">{title}</div>
      <div className="relative h-40">
        <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold text-white">{total}</div>
          <div className="text-[10px] text-slate-500">Total</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5 mt-3">
        {data.map(d => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-slate-400 truncate">{d.name}</span>
            <span className="text-white font-semibold ml-auto">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Events Feed ───────────────────────────────────────────────
function EventsFeed({ events }: { events: any[] }) {
  return (
    <div className="glass rounded-2xl p-5 border border-white/8 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity size={15} className="text-cyan-400" />
          Live Event Feed
        </div>
        <div className="flex items-center gap-1 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full live-indicator" />Live
        </div>
      </div>
      <div className="space-y-2 overflow-y-auto flex-1">
        {events.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">No recent events</div>
        ) : events.slice(0, 6).map((e) => (
          <div key={e.id}
            className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/4 transition-colors cursor-pointer">
            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${e.severity === 'critical' ? 'bg-red-400' : e.severity === 'warning' ? 'bg-amber-400' : 'bg-blue-400'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-200 truncate">{e.title}</div>
              <div className="text-[11px] text-slate-500">{e.device} · {timeAgo(e.createdAt ?? e.timestamp)}</div>
            </div>
            <span className={`badge ${getSeverityColor(e.severity)} shrink-0 text-[10px]`}>{e.severity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Quick Actions ─────────────────────────────────────────────
function QuickActions({ navigate }: { navigate: (p: string) => void }) {
  const actions = [
    { label: 'Add Device', icon: Plus, color: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25', path: '/inventory/devices' },
    { label: 'Run Ping Check', icon: Radar, color: 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25', path: '/operations/scheduler' },
    { label: 'View Scheduler', icon: Activity, color: 'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25', path: '/operations/scheduler' },
    { label: 'Generate Report', icon: FileText, color: 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25', path: '/reports' },
  ];
  return (
    <div className="glass rounded-2xl p-5 border border-white/8">
      <div className="text-sm font-semibold text-white mb-4">Quick Actions</div>
      <div className="grid grid-cols-1 gap-2">
        {actions.map(a => (
          <button key={a.label} onClick={() => navigate(a.path)}
            className={`flex items-center gap-3 p-3 rounded-xl text-sm font-medium transition-all border border-white/6 ${a.color}`}>
            <a.icon size={15} />
            {a.label}
            <ArrowRight size={13} className="ml-auto opacity-50" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Jobs Widget ───────────────────────────────────────────────
function JobsWidget({ jobs }: { jobs: any[] }) {
  const statusIcon = { success: CheckCircle2, failed: XCircle, running: RefreshCw, paused: Clock, scheduled: Calendar };
  const statusColor = { success: 'text-emerald-400', failed: 'text-red-400', running: 'text-blue-400', paused: 'text-amber-400', scheduled: 'text-slate-400' };
  return (
    <div className="glass rounded-2xl p-5 border border-white/8">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={15} className="text-cyan-400" />
        <span className="text-sm font-semibold text-white">Scheduled Jobs</span>
      </div>
      <div className="space-y-2">
        {jobs.length === 0 ? (
          <div className="text-center py-4 text-slate-500 text-xs">No jobs configured</div>
        ) : jobs.slice(0, 5).map(job => {
          const Icon = statusIcon[job.status as keyof typeof statusIcon] ?? Calendar;
          return (
            <div key={job.id} className="flex items-center gap-3 py-2 border-b border-white/4 last:border-0">
              <Icon size={14} className={cn((statusColor as any)[job.status] ?? 'text-slate-400', job.status === 'running' && 'animate-spin')} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-200 truncate">{job.name}</div>
                <div className="text-[11px] text-slate-500">{job.frequency}</div>
              </div>
              {job.progress != null && (
                <div className="w-16 h-1.5 bg-white/6 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${job.progress}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Host Problems Table ───────────────────────────────────────
function ProblemsTable({ alerts }: { alerts: any[] }) {
  const problems = alerts.filter(a => a.status === 'active').slice(0, 5);
  return (
    <div className="glass rounded-2xl p-5 border border-white/8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server size={15} className="text-red-400" />
          <span className="text-sm font-semibold text-white">Host Problems</span>
        </div>
        <span className="badge badge-critical">{problems.length}</span>
      </div>
      {problems.length === 0 ? (
        <div className="text-center py-6 text-slate-500 text-xs">No active problems</div>
      ) : (
        <table className="nms-table">
          <thead><tr><th>Device</th><th>Issue</th><th>Duration</th><th>Severity</th></tr></thead>
          <tbody>
            {problems.map(p => (
              <tr key={p.id}>
                <td className="font-mono text-blue-400 text-xs">{p.device}</td>
                <td className="text-xs">{p.title}</td>
                <td className="text-xs font-mono">{p.duration}</td>
                <td><span className={`badge ${getSeverityColor(p.severity)}`}>{p.severity}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── MAIN DASHBOARD ────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [devRes, altRes, jobRes] = await Promise.all([
        devicesApi.list().catch(() => ({ data: [] })),
        alertsApi.list().catch(() => ({ data: [] })),
        jobsApi.list().catch(() => ({ data: [] })),
      ]);
      setDevices((devRes as any).data ?? []);
      setAlerts((altRes as any).data ?? []);
      setJobs((jobRes as any).data ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const online = devices.filter(d => d.status === 'online').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const warning = devices.filter(d => d.status === 'warning').length;
  const critical = alerts.filter(a => a.severity === 'critical' && a.status === 'active').length;

  const hostDonut = [
    { name: 'Online', value: online, color: '#10b981' },
    { name: 'Warning', value: warning, color: '#f59e0b' },
    { name: 'Offline', value: offline, color: '#ef4444' },
    { name: 'Unknown', value: devices.filter(d => d.status === 'unknown').length, color: '#64748b' },
  ];
  const svcDonut = [
    { name: 'OK', value: alerts.filter(a => a.status === 'resolved' || a.status === 'acknowledged').length, color: '#10b981' },
    { name: 'Warning', value: alerts.filter(a => a.severity === 'warning' && a.status === 'active').length, color: '#f59e0b' },
    { name: 'Critical', value: alerts.filter(a => a.severity === 'critical' && a.status === 'active').length, color: '#ef4444' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">NOC Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Real-time infrastructure overview · Live WebSocket updates</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full live-indicator" />
            Live Monitoring
          </div>
          <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 border border-white/10 hover:bg-white/6 transition-all">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <KPICard title="Total Devices" value={devices.length} icon={Server} color="bg-blue-600/80" trend="flat" sub="In inventory" onClick={() => navigate('/inventory/devices')} />
        <KPICard title="Online" value={online} icon={Wifi} color="bg-emerald-600/80" trend="flat" sub="Healthy" onClick={() => navigate('/inventory/devices?status=online')} />
        <KPICard title="Offline" value={offline} icon={WifiOff} color="bg-red-600/80" trend="down" sub="Needs attention" onClick={() => navigate('/inventory/devices?status=offline')} />
        <KPICard title="Critical Alerts" value={critical} icon={AlertTriangle} color="bg-orange-600/80" trend="up" sub="Active now" onClick={() => navigate('/monitoring/alerts?severity=critical')} />
        <KPICard title="Active Incidents" value={alerts.filter(a => a.status === 'active').length} icon={Activity} color="bg-indigo-600/80" trend="up" sub="Ongoing" onClick={() => navigate('/monitoring/alerts?status=active')} />
      </div>

      {/* Row 2: Donuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DonutChart title="Host Status" data={hostDonut} />
        <DonutChart title="Alerts" data={svcDonut} />
      </div>

      {/* Row 3: Events + Problems + Jobs + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 space-y-4">
          <EventsFeed events={alerts} />
          <ProblemsTable alerts={alerts} />
        </div>
        <div className="space-y-4">
          <JobsWidget jobs={jobs} />
          <QuickActions navigate={navigate} />
        </div>
      </div>
    </div>
  );
}
