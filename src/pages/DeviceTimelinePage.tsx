import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Clock, RefreshCw, Download, ChevronDown, CheckCircle2, XCircle, Wifi } from 'lucide-react';
import { devicesApi } from '../lib/api';

// Timeline timestamps are real UTC (inserted via new Date()), so keep the Z
// and let the browser handle UTC → local (IST) conversion correctly.
function formatDateTime(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Segment {
  id: number;
  state: 'online' | 'offline';
  startedAt: string;
  endedAt: string | null;
  durationSecs: number;
  durationPct: string;
  summary: string;
  isCurrent: boolean;
}

interface TimelineData {
  device: { id: string; hostname: string; ip: string; status: string };
  range: string;
  windowStart: string;
  windowEnd: string;
  segments: Segment[];
  leadingGap: {
    from: string;
    to: string;
    durationSecs: number;
    durationPct: string;
  } | null;
  totalOnlineSecs: number;
  totalSecs: number;
  uptimePct: string;
}

interface Device {
  id: string;
  hostname: string;
  ip: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RANGES = [
  { key: '4h',   label: 'Last 4 hours' },
  { key: '24h',  label: '24 hours' },
  { key: '7d',   label: '7 days' },
  { key: '30d',  label: '30 days' },
  { key: '365d', label: '365 days' },
];

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h < 24) return `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function SegmentTooltip({ seg, x }: { seg: Segment; x: number }) {
  return (
    <div
      className="absolute z-50 bottom-full mb-2 pointer-events-none"
      style={{ left: `${x}%`, transform: 'translateX(-50%)' }}
    >
      <div className="glass border border-white/15 rounded-xl p-3 shadow-2xl min-w-[220px] text-xs">
        <div className={`flex items-center gap-2 mb-2 font-semibold ${seg.state === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
          {seg.state === 'online' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {seg.state === 'online' ? 'UP / OK' : 'DOWN'}
          {seg.isCurrent && <span className="ml-auto text-[10px] text-slate-400 font-normal">Current</span>}
        </div>
        <div className="space-y-1 text-slate-400">
          <div><span className="text-slate-500">From:</span> {formatDateTime(seg.startedAt)}</div>
          <div><span className="text-slate-500">Until:</span> {seg.endedAt ? formatDateTime(seg.endedAt) : '—'}</div>
          <div><span className="text-slate-500">Duration:</span> {formatDuration(seg.durationSecs)} ({seg.durationPct}%)</div>
          {seg.summary && <div className="text-slate-500 mt-1 border-t border-white/8 pt-1">{seg.summary}</div>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function DeviceTimelinePage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [range, setRange] = useState('24h');
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoveredSeg, setHoveredSeg] = useState<{ seg: Segment; x: number } | null>(null);
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load device list
  useEffect(() => {
    devicesApi.list().then(r => {
      setDevices(r.data);
      if (r.data.length > 0 && !selectedId) setSelectedId(r.data[0].id);
    }).catch(console.error);
  }, []);

  // Fetch timeline data
  const fetchTimeline = useCallback(async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const result = await devicesApi.timeline(selectedId, range);
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedId, range]);

  // Auto-refresh every 60s
  useEffect(() => {
    fetchTimeline();
    refreshRef.current = setInterval(fetchTimeline, 60_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [fetchTimeline]);

  // Download CSV
  const downloadCSV = () => {
    if (!data) return;
    const headers = ['From', 'Until', 'Duration', 'Duration %', 'State', 'Summary'];
    const rows = data.segments.map(s => [
      formatDateTime(s.startedAt),
      s.endedAt ? formatDateTime(s.endedAt) : 'Current',
      formatDuration(s.durationSecs),
      `${s.durationPct}%`,
      s.state === 'online' ? 'OK' : 'Down',
      s.summary ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeline_${data.device.hostname}_${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedDevice = devices.find(d => d.id === selectedId);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Service Availability Timeline</h1>
          <p className="text-sm text-slate-500 mt-1">Monitor → Service Statistics → Availability → Timeline</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            id="timeline-refresh"
            onClick={fetchTimeline}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all text-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            id="timeline-download"
            onClick={downloadCSV}
            disabled={!data}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all text-sm disabled:opacity-40"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Device Selector + Range Tabs */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Device Dropdown */}
        <div className="relative">
          <button
            id="timeline-device-selector"
            onClick={() => setShowDeviceDropdown(v => !v)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl glass border border-white/10 text-white hover:border-white/20 transition-all min-w-[260px]"
          >
            <Wifi size={16} className="text-blue-400" />
            <span className="flex-1 text-left text-sm font-medium truncate">
              {selectedDevice ? `${selectedDevice.hostname} — ${selectedDevice.ip}` : 'Select device…'}
            </span>
            <ChevronDown size={14} className={`text-slate-400 transition-transform ${showDeviceDropdown ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showDeviceDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-2 left-0 w-full z-50 glass border border-white/12 rounded-2xl shadow-2xl max-h-72 overflow-y-auto overscroll-contain"
              >
                <div className="py-1">
                {devices.map(d => (
                  <button
                    key={d.id}
                    onClick={() => { setSelectedId(d.id); setShowDeviceDropdown(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-all text-sm ${d.id === selectedId ? 'text-blue-400' : 'text-slate-300'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${d.status === 'online' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <span className="font-medium">{d.hostname}</span>
                    <span className="ml-auto text-slate-500 text-xs font-mono">{d.ip}</span>
                  </button>
                ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Range tabs */}
        <div className="flex items-center gap-1 glass rounded-xl border border-white/10 p-1">
          {RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                range === r.key
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <div className="glass rounded-2xl border border-white/8 p-5">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Device</div>
            <div className="flex items-center gap-2">
              <Server size={16} className="text-blue-400" />
              <span className="text-white font-semibold">{data.device.hostname}</span>
              <span className="text-slate-500 text-xs font-mono">{data.device.ip}</span>
            </div>
          </div>
          <div className="glass rounded-2xl border border-white/8 p-5">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Overall Uptime</div>
            <div className="text-3xl font-bold text-emerald-400">{data.uptimePct}%</div>
          </div>
          <div className="glass rounded-2xl border border-white/8 p-5">
            <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">State Changes</div>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-lg font-bold text-emerald-400">{data.segments.filter(s => s.state === 'online').length}</div>
                <div className="text-[10px] text-slate-500">UP events</div>
              </div>
              <div className="w-px h-8 bg-white/8" />
              <div>
                <div className="text-lg font-bold text-red-400">{data.segments.filter(s => s.state === 'offline').length}</div>
                <div className="text-[10px] text-slate-500">DOWN events</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Bar */}
      {data && (
        <div className="glass rounded-2xl border border-white/8 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-white uppercase tracking-wider">Availability Timeline</span>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Online (OK)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Offline (Down)</span>
            </div>
          </div>

          {/* Visual bar */}
          {data.segments.length === 0 ? (
            <div className="h-12 rounded-xl bg-white/5 flex items-center justify-center text-slate-500 text-sm">
              No data for this time range yet. The ping monitor will populate this after the next poll.
            </div>
          ) : (() => {
            let offset = 0;
            return (
              <div className="relative h-12 rounded-xl overflow-hidden border border-white/8 bg-[#0a1628]"
                onMouseLeave={() => setHoveredSeg(null)}
              >
                {data.segments.map((seg) => {
                  const pct = parseFloat(seg.durationPct);
                  const left = offset;
                  offset += pct;
                  if (pct <= 0) return null;
                  return (
                    <div
                      key={seg.id}
                      onMouseEnter={(e) => {
                        const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 100;
                        setHoveredSeg({ seg, x: Math.min(Math.max(x, 10), 90) });
                      }}
                      className="absolute top-0 h-full transition-all cursor-pointer hover:brightness-125"
                      style={{
                        left: `${left}%`,
                        width: `${pct}%`,
                        background: seg.state === 'online'
                          ? 'linear-gradient(135deg, #10b981, #059669)'
                          : 'linear-gradient(135deg, #ef4444, #b91c1c)',
                        borderRight: '1px solid rgba(0,0,0,0.3)',
                      }}
                    />
                  );
                })}
                {/* Hover tooltip */}
                <AnimatePresence>
                  {hoveredSeg && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="absolute bottom-full mb-2 z-50 pointer-events-none"
                      style={{ left: `${hoveredSeg.x}%`, transform: 'translateX(-50%)' }}
                    >
                      <SegmentTooltip seg={hoveredSeg.seg} x={hoveredSeg.x} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })()}

          {/* Timeline axis */}
          <div className="flex justify-between text-[10px] text-slate-600 mt-2">
            <span>{formatDateTime(data.windowStart)}</span>
            <Clock size={10} className="text-slate-600 self-center" />
            <span>{formatDateTime(data.windowEnd)}</span>
          </div>
        </div>
      )}

      {/* State Table */}
      {data && (data.segments.length > 0 || data.leadingGap) && (() => {
        // Current segment first, then newest → oldest
        const sortedSegments = [...data.segments].sort((a, b) => {
          if (a.isCurrent && !b.isCurrent) return -1;
          if (!a.isCurrent && b.isCurrent) return 1;
          return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
        });

        return (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl border border-white/8 overflow-hidden"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest text-slate-500 font-semibold">From</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Until</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Duration</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Duration %</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest text-slate-500 font-semibold">State</th>
                  <th className="px-5 py-3 text-left text-[11px] uppercase tracking-widest text-slate-500 font-semibold">Last Known Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {sortedSegments.map((seg, i) => (
                  <motion.tr
                    key={seg.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-white/3 transition-colors"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {formatDateTime(seg.startedAt)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {seg.endedAt ? formatDateTime(seg.endedAt) : (
                        <span className={`flex items-center gap-1.5 ${seg.state === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${seg.state === 'online' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          Current
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-300">
                      {formatDuration(seg.durationSecs)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-white/6 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${seg.durationPct}%`,
                              background: seg.state === 'online' ? '#10b981' : '#ef4444',
                            }}
                          />
                        </div>
                        <span className="text-slate-400">{seg.durationPct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {seg.state === 'online' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
                          <CheckCircle2 size={11} /> OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-semibold">
                          <XCircle size={11} /> Down
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 max-w-xs truncate" title={seg.summary ?? ''}>
                      {seg.summary ?? '—'}
                    </td>
                  </motion.tr>
                ))}
                {data.leadingGap && (
                  <motion.tr
                    key="leading-gap"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="hover:bg-white/3 transition-colors opacity-60"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(data.leadingGap.from)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(data.leadingGap.to)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">
                      {formatDuration(data.leadingGap.durationSecs)}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-white/6 overflow-hidden">
                          <div className="h-full rounded-full bg-slate-600" style={{ width: `${data.leadingGap.durationPct}%` }} />
                        </div>
                        <span>{data.leadingGap.durationPct}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-500/15 border border-slate-500/25 text-slate-400 text-xs font-semibold">
                        — No Data
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 italic">
                      Not monitored during this period
                    </td>
                  </motion.tr>
                )}
              </tbody>
            </table>
          </motion.div>
        );
      })()}


      {/* Empty / No device */}
      {!selectedId && (
        <div className="glass rounded-2xl border border-white/8 p-16 text-center">
          <Server size={40} className="mx-auto mb-4 text-slate-600" />
          <p className="text-slate-500">Select a device above to view its availability timeline.</p>
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="glass rounded-2xl border border-white/8 p-16 text-center">
          <RefreshCw size={32} className="mx-auto mb-4 text-blue-400 animate-spin" />
          <p className="text-slate-500">Loading timeline data…</p>
        </div>
      )}
    </div>
  );
}
