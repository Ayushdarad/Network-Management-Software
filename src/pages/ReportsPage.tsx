import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactECharts from 'echarts-for-react';
import {
  Download, FileText, Calendar,
  Clock, X, Check, Loader2
} from 'lucide-react';
import { showToast } from '../components/Toast';
import { devicesApi, alertsApi, logsApi } from '../lib/api';

// ─── Report definitions ────────────────────────────────────────
const REPORT_TYPES = [
  { id: 'devices',      name: 'Device Inventory Report',      type: 'Inventory',    format: 'CSV', icon: '🖥️' },
  { id: 'uptime',       name: 'Uptime & Downtime Report',     type: 'Availability', format: 'CSV', icon: '📶' },
  { id: 'alerts',       name: 'Alert History Report',         type: 'Incidents',    format: 'CSV', icon: '🔔' },
  { id: 'logs',         name: 'Syslog Export',                type: 'Logs',         format: 'CSV', icon: '📋' },
  { id: 'incidents',    name: 'Incident Summary',             type: 'Incidents',    format: 'CSV', icon: '🚨' },
];

const TIMELINE_PRESETS = [
  { label: 'Last 24 Hours',  days: 1 },
  { label: 'Last 7 Days',    days: 7 },
  { label: 'Last 30 Days',   days: 30 },
  { label: 'Last 90 Days',   days: 90 },
  { label: 'Custom Range',   days: 0 },
];

// ─── CSV helpers ───────────────────────────────────────────────
function toCSV(headers: string[], rows: any[][]): string {
  const escape = (v: any) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return s.includes(',') || s.includes('\n') || s.includes('"') ? `"${s}"` : s;
  };
  return [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
}

function downloadFile(filename: string, content: string, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dateRange(days: number, from?: string, to?: string): { from: Date; to: Date } {
  // "to" is always end of current moment (now), never midnight
  const toDate = to
    ? (() => { const d = new Date(to); d.setHours(23, 59, 59, 999); return d; })()
    : new Date();                                           // right now
  const fromDate = from
    ? (() => { const d = new Date(from); d.setHours(0, 0, 0, 0); return d; })()
    : new Date(toDate.getTime() - days * 86400000);        // exact ms back
  return { from: fromDate, to: toDate };
}

// ─── Uptime widget (live from API) ────────────────────────────
function UptimeWidget() {
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    devicesApi.list().then(r => setDevices(r.data)).catch(() => {});
  }, []);

  const rows = devices.map(d => {
    const total   = d.totalPolls  ?? 0;
    const online  = d.onlinePolls ?? 0;
    const pct     = total > 0 ? ((online / total) * 100).toFixed(2) : '—';
    const downtimePct = total > 0 ? (((total - online) / total) * 100).toFixed(2) : '—';
    return { ...d, uptimePct: pct, downtimePct };
  }).sort((a, b) => parseFloat(a.uptimePct) - parseFloat(b.uptimePct));

  return (
    <div className="glass rounded-2xl p-5 border border-white/8 col-span-2">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-white">Device Uptime &amp; Downtime</span>
        <span className="text-xs text-slate-500 ml-1">— based on real ICMP poll results</span>
      </div>
      {rows.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="nms-table w-full">
            <thead>
              <tr>
                <th>Status</th>
                <th>Hostname</th>
                <th>IP</th>
                <th>Site</th>
                <th>Total Polls</th>
                <th>Online Polls</th>
                <th>Uptime %</th>
                <th>Downtime %</th>
                <th>Current Uptime</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(d => {
                const up = parseFloat(d.uptimePct);
                const color = isNaN(up) ? 'text-slate-400' : up >= 99 ? 'text-emerald-400' : up >= 95 ? 'text-amber-400' : 'text-red-400';
                return (
                  <tr key={d.id}>
                    <td>
                      <span className={`status-dot ${d.status} inline-block`} />
                      <span className={`text-xs font-medium ml-1.5 ${
                        d.status === 'online' ? 'text-emerald-400' :
                        d.status === 'offline' ? 'text-red-400' :
                        d.status === 'warning' ? 'text-amber-400' : 'text-slate-400'
                      }`}>{d.status}</span>
                    </td>
                    <td className="font-mono text-blue-400 text-xs">{d.hostname}</td>
                    <td className="font-mono text-xs text-slate-400">{d.ip}</td>
                    <td className="text-xs text-slate-400">{d.site}</td>
                    <td className="font-mono text-xs text-slate-300 text-center">{d.totalPolls ?? 0}</td>
                    <td className="font-mono text-xs text-emerald-400 text-center">{d.onlinePolls ?? 0}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-white/6 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${isNaN(up) ? 0 : up}%`, background: isNaN(up) ? '#64748b' : '#10b981' }} />
                        </div>
                        <span className="font-mono text-xs font-semibold text-emerald-400">{d.uptimePct}%</span>
                      </div>
                    </td>
                    <td className={`font-mono text-xs ${parseFloat(d.downtimePct) > 5 ? 'text-red-400' : 'text-slate-400'}`}>
                      {d.downtimePct}%
                    </td>
                    <td className="font-mono text-xs text-slate-300">{d.uptime}</td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {d.lastSeen ? new Date(d.lastSeen).toLocaleString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function IncidentTrendChart() {
  const [months, setMonths] = useState<string[]>([]);
  const [incidentCounts, setIncidentCounts] = useState<number[]>([]);
  const [resolvedCounts, setResolvedCounts] = useState<number[]>([]);

  useEffect(() => {
    alertsApi.list().then(res => {
      const now = new Date();
      const labels: string[] = [];
      const incidents: number[] = [];
      const resolved: number[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(d.toLocaleString('default', { month: 'short' }));
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const inMonth = res.data.filter(a => {
          const created = new Date(a.createdAt);
          return created >= monthStart && created <= monthEnd;
        });
        incidents.push(inMonth.length);
        resolved.push(inMonth.filter(a => a.status === 'resolved').length);
      }
      setMonths(labels);
      setIncidentCounts(incidents);
      setResolvedCounts(resolved);
    }).catch(() => {});
  }, []);

  const option  = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#111e35', borderColor: 'rgba(255,255,255,0.1)', textStyle: { color: '#f1f5f9' } },
    legend: { bottom: 0, textStyle: { color: '#94a3b8', fontSize: 11 }, icon: 'circle', itemWidth: 8 },
    grid: { top: 12, right: 12, bottom: 36, left: 40 },
    xAxis: { type: 'category', data: months, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#475569', fontSize: 11 } },
    yAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#475569', fontSize: 10 }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } } },
    series: [
      { name: 'Incidents', type: 'bar', data: incidentCounts, barWidth: 18, borderRadius: 4, itemStyle: { color: '#ef4444' } },
      { name: 'Resolved',  type: 'bar', data: resolvedCounts,  barWidth: 18, borderRadius: 4, itemStyle: { color: '#10b981' } },
    ]
  };
  return (
    <div className="glass rounded-2xl p-5 border border-white/8">
      <div className="text-sm font-semibold text-white mb-3">Incident Trend — 6 Months</div>
      <ReactECharts option={option} style={{ height: '200px' }} />
    </div>
  );
}

// ─── Custom Range Modal ────────────────────────────────────────
function CustomRangeModal({ onApply, onClose }: {
  onApply: (from: string, to: string) => void;
  onClose: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const week  = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const [from, setFrom] = useState(week);
  const [to,   setTo]   = useState(today);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="glass rounded-2xl border border-white/10 p-6 w-full max-w-sm relative z-10 shadow-glass"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <X size={18} />
        </button>
        <div className="flex items-center gap-2 mb-5">
          <Calendar size={18} className="text-blue-400" />
          <h2 className="text-base font-semibold text-white">Custom Date Range</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">From</label>
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-all" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">To</label>
            <input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/50 transition-all" />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-slate-300 border border-white/10 hover:bg-white/5 transition-all">Cancel</button>
          <button onClick={() => { onApply(from, to); onClose(); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all flex items-center justify-center gap-2">
            <Check size={14} /> Apply Range
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────
export default function ReportsPage() {
  const [selectedPreset, setSelectedPreset] = useState(TIMELINE_PRESETS[1]);
  const [customFrom,     setCustomFrom]     = useState('');
  const [customTo,       setCustomTo]       = useState('');
  const [showCustom,     setShowCustom]     = useState(false);
  const [generating,     setGenerating]     = useState<string | null>(null);
  const [generated,      setGenerated]      = useState<Set<string>>(new Set());
  const [reportData,     setReportData]     = useState<Record<string, string>>({}); // id → csv content

  const timelineLabel = selectedPreset.days === 0
    ? `${customFrom} → ${customTo}`
    : selectedPreset.label;

  const getRange = () => {
    if (selectedPreset.days === 0 && customFrom && customTo)
      return dateRange(0, customFrom, customTo);
    return dateRange(selectedPreset.days);
  };

  // ── Generate: fetch real data and build CSV in memory ────────
  const handleGenerate = async (report: typeof REPORT_TYPES[0]) => {
    if (selectedPreset.days === 0 && (!customFrom || !customTo)) {
      showToast('Please set a custom date range first', 'error');
      setShowCustom(true);
      return;
    }
    setGenerating(report.id);
    const { from, to } = getRange();
    const fromStr = from.toISOString();
    const toStr   = to.toISOString();

    try {
      let csv = '';

      if (report.id === 'devices' || report.id === 'uptime') {
        const res = await devicesApi.list();
        if (report.id === 'devices') {
          csv = toCSV(
            ['ID','Hostname','IP','Type','Direction','Location','Site','Status',
             'Total Polls','Online Polls','Uptime %','Downtime %','Last Seen'],
            res.data.map(d => {
              const total       = d.totalPolls  ?? 0;
              const online      = d.onlinePolls ?? 0;
              const uptimePct   = total > 0 ? ((online / total) * 100).toFixed(2) + '%' : 'N/A';
              const downtimePct = total > 0 ? (((total - online) / total) * 100).toFixed(2) + '%' : 'N/A';
              return [
                d.id, d.hostname, d.ip, d.type, d.vendor,
                d.location, d.site, d.status,
                total, online, uptimePct, downtimePct,
                d.lastSeen ? new Date(d.lastSeen).toLocaleString() : '',
              ];
            })
          );
        } else {
          csv = toCSV(
            ['Hostname','IP','Site','Type','Current Status','Current Uptime','Total Polls','Online Polls','Uptime %','Downtime %','Last Seen'],
            res.data.map(d => {
              const total   = d.totalPolls  ?? 0;
              const online  = d.onlinePolls ?? 0;
              const uptimePct   = total > 0 ? ((online / total) * 100).toFixed(2) : 'N/A';
              const downtimePct = total > 0 ? (((total - online) / total) * 100).toFixed(2) : 'N/A';
              return [
                d.hostname, d.ip, d.site, d.type,
                d.status, d.uptime,
                total, online,
                uptimePct + (uptimePct !== 'N/A' ? '%' : ''),
                downtimePct + (downtimePct !== 'N/A' ? '%' : ''),
                d.lastSeen ? new Date(d.lastSeen).toLocaleString() : '',
              ];
            })
          );
        }
      } else if (report.id === 'alerts' || report.id === 'incidents') {
        const res = await alertsApi.list();
        const filtered = res.data.filter((a: any) => {
          const t = new Date(a.createdAt ?? a.updatedAt).getTime();
          return t >= from.getTime() && t <= to.getTime();
        });
        csv = toCSV(
          ['ID','Severity','Status','Title','Device','IP','Site','Category','Duration','Count','Created At'],
          filtered.map((a: any) => [a.id, a.severity, a.status, a.title, a.device, a.deviceIp, a.site, a.category, a.duration, a.count, a.createdAt])
        );
      } else if (report.id === 'logs') {
        const res = await logsApi.list({ from: fromStr, to: toStr, limit: '5000' });
        csv = toCSV(
          ['ID','Level','Source','Source IP','Facility','Message','Created At'],
          res.data.map((l: any) => [l.id, l.level, l.source, l.sourceIp, l.facility, l.message, l.createdAt])
        );
      }

      // Add metadata header
      const localTime = new Date().toLocaleString();
      const header = `# ${report.name}\n# Timeline: ${timelineLabel}\n# Generated: ${localTime}\n# From: ${from.toLocaleString()} | To: ${to.toLocaleString()}\n\n`;
      const full   = header + csv;

      setReportData(prev => ({ ...prev, [report.id]: full }));
      setGenerated(prev => new Set([...prev, report.id]));
      showToast(`"${report.name}" ready — click Download`, 'success');
    } catch {
      showToast(`Failed to generate "${report.name}"`, 'error');
    } finally {
      setGenerating(null);
    }
  };

  // ── Download: save CSV file to disk ─────────────────────────
  const handleDownload = (report: typeof REPORT_TYPES[0]) => {
    const csv = reportData[report.id];
    if (!csv) { showToast('Generate the report first', 'error'); return; }
    const now      = new Date();
    const date     = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const filename = `${report.id}-report-${date}.csv`;
    downloadFile(filename, csv);
    showToast(`Saved: ${filename}`, 'success');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-sm text-slate-500">Generate and download real data reports to your PC</p>
        </div>
      </div>

      {/* Uptime & Downtime Table */}
      <div className="grid grid-cols-2 gap-4">
        <UptimeWidget />
      </div>

      {/* Incident Trend Chart */}
      <IncidentTrendChart />

      {/* Report Templates */}
      <div className="glass rounded-2xl p-5 border border-white/8">
        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-blue-400" />
            <span className="text-sm font-semibold text-white">Generate Reports</span>
          </div>

          {/* Timeline selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Timeline:</span>
            <div className="flex items-center gap-1 flex-wrap">
              {TIMELINE_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => {
                    if (p.days === 0) { setShowCustom(true); }
                    else { setSelectedPreset(p); setCustomFrom(''); setCustomTo(''); }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    selectedPreset.label === p.label
                      ? 'bg-blue-600/25 text-blue-400 border-blue-500/40'
                      : 'bg-white/4 text-slate-400 border-white/8 hover:text-white hover:bg-white/8'
                  }`}
                >
                  {p.days === 0 ? (
                    <span className="flex items-center gap-1"><Calendar size={11} /> Custom</span>
                  ) : p.label}
                </button>
              ))}
            </div>
            {selectedPreset.days === 0 && customFrom && customTo && (
              <span className="text-xs text-cyan-400 font-mono ml-1">{customFrom} → {customTo}</span>
            )}
          </div>
        </div>

        {/* Report rows */}
        <div className="space-y-3">
          {REPORT_TYPES.map((r, i) => {
            const isGen  = generating === r.id;
            const isDone = generated.has(r.id);
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/3 border border-white/6 hover:border-white/12 hover:bg-white/5 transition-all"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0 text-lg">
                  {r.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200">{r.name}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span className="badge badge-info text-[10px]">{r.type}</span>
                    <span className="flex items-center gap-1"><FileText size={10} />{r.format}</span>
                    <span className="flex items-center gap-1"><Clock size={10} />{timelineLabel}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isGen ? (
                    <div className="flex items-center gap-2 text-xs text-blue-400 px-3 py-1.5">
                      <Loader2 size={13} className="animate-spin" />
                      Generating...
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleGenerate(r)}
                        className="px-3 py-1.5 rounded-lg text-xs bg-blue-600/20 text-blue-400 border border-blue-500/20 hover:bg-blue-600/30 transition-all"
                      >
                        Generate
                      </button>
                      <button
                        onClick={() => handleDownload(r)}
                        disabled={!isDone}
                        title={isDone ? `Download ${r.name}` : 'Generate first'}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                          isDone
                            ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/20 hover:bg-emerald-600/30'
                            : 'bg-white/3 text-slate-600 border-white/6 cursor-not-allowed'
                        }`}
                      >
                        <Download size={13} />
                        {isDone ? 'Download' : 'Download'}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Info note */}
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-white/3 rounded-xl px-4 py-2.5 border border-white/6">
          <Download size={12} className="text-slate-400 shrink-0" />
          Reports are saved as <span className="text-slate-300 font-mono">.csv</span> files directly to your PC's default download folder.
          Generate first, then click Download.
        </div>
      </div>

      {/* Custom Range Modal */}
      <AnimatePresence>
        {showCustom && (
          <CustomRangeModal
            onApply={(from, to) => {
              setCustomFrom(from);
              setCustomTo(to);
              setSelectedPreset(TIMELINE_PRESETS[4]); // Custom
            }}
            onClose={() => setShowCustom(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
