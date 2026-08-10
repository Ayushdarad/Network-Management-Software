import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { X, Bot, Send, Sparkles, Loader2 } from 'lucide-react';
import { devicesApi, alertsApi, logsApi, jobsApi, assetsApi, usersApi } from '../../lib/api';

interface Message { role: 'user' | 'ai'; text: string; }

const suggestions = [
  'How many devices are offline?',
  'Show me critical alerts',
  'Which devices are in warning state?',
  'What is the overall network health?',
  'Show recent error logs',
  'Which devices are online?',
  'Tell me about the alerts',
  'What\'s the status of my network?',
  'Show me scheduled jobs',
  'List all assets',
];

// ─── NMS Intelligence Engine ──────────────────────────────────
async function processQuery(query: string): Promise<string> {
  const q = query.toLowerCase().trim();

  try {
    // ── Device queries ─────────────────────────────────────────
    if (q.includes('offline') || q.includes('down') || q.includes('unreachable')) {
      const res = await devicesApi.list({ status: 'offline' });
      const devices = res.data;
      if (devices.length === 0) return '✅ **All devices are reachable.** No offline devices detected at this time.';
      const list = devices.map((d: any) =>
        `• **${d.hostname}** (${d.ip}) — ${d.site} — Last seen: ${d.lastSeen ? new Date(d.lastSeen).toLocaleString() : 'unknown'}`
      ).join('\n');
      return `🔴 **${devices.length} device(s) currently offline:**\n\n${list}`;
    }

    if (q.includes('online') && (q.includes('device') || q.includes('host') || q.includes('how many') || q.includes('which'))) {
      const res = await devicesApi.list({ status: 'online' });
      const devices = res.data;
      const list = devices.slice(0, 10).map((d: any) =>
        `• **${d.hostname}** (${d.ip}) — ${d.type} — ${d.site}`
      ).join('\n');
      const more = devices.length > 10 ? `\n\n...and ${devices.length - 10} more.` : '';
      return `✅ **${devices.length} device(s) currently online:**\n\n${list}${more}`;
    }

    if (q.includes('warning') && (q.includes('device') || q.includes('host'))) {
      const res = await devicesApi.list({ status: 'warning' });
      const devices = res.data;
      if (devices.length === 0) return '✅ No devices in warning state.';
      const list = devices.map((d: any) =>
        `• **${d.hostname}** (${d.ip}) — ${d.site} — status: ${d.status}`
      ).join('\n');
      return `⚠️ **${devices.length} device(s) in warning state:**\n\n${list}`;
    }

    if ((q.includes('how many') || q.includes('count') || q.includes('total')) && q.includes('device')) {
      const res = await devicesApi.list();
      const all     = res.data;
      const online  = all.filter((d: any) => d.status === 'online').length;
      const offline = all.filter((d: any) => d.status === 'offline').length;
      const warning = all.filter((d: any) => d.status === 'warning').length;
      const unknown = all.filter((d: any) => d.status === 'unknown').length;
      return `📊 **Device inventory summary:**\n\n• Total devices: **${all.length}**\n• 🟢 Online: **${online}**\n• 🔴 Offline: **${offline}**\n• ⚠️ Warning: **${warning}**\n• ❓ Unknown: **${unknown}**`;
    }

    if (q.includes('device') && (q.includes('list') || q.includes('all') || q.includes('show'))) {
      const res = await devicesApi.list();
      const byType: Record<string, number> = {};
      res.data.forEach((d: any) => { byType[d.type] = (byType[d.type] ?? 0) + 1; });
      const typeList = Object.entries(byType).map(([t, n]) => `• ${t}: ${n}`).join('\n');
      return `🖥️ **${res.data.length} total devices across all sites:**\n\n${typeList}\n\nUse "show offline devices" or "show online devices" to filter by status.`;
    }

    if (q.includes('site') || q.includes('location')) {
      const res = await devicesApi.list();
      const bySite: Record<string, { total: number; offline: number }> = {};
      res.data.forEach((d: any) => {
        if (!bySite[d.site]) bySite[d.site] = { total: 0, offline: 0 };
        bySite[d.site].total++;
        if (d.status === 'offline') bySite[d.site].offline++;
      });
      const list = Object.entries(bySite).map(([site, s]) =>
        `• **${site}** — ${s.total} devices${s.offline > 0 ? ` ⚠️ ${s.offline} offline` : ' ✅ all up'}`
      ).join('\n');
      return `🗺️ **Devices by site:**\n\n${list}`;
    }

    if (q.includes('uptime') && (q.includes('best') || q.includes('top') || q.includes('highest'))) {
      const res = await devicesApi.list();
      const sorted = res.data
        .filter((d: any) => (d.totalPolls ?? 0) > 0)
        .map((d: any) => ({ ...d, upPct: (d.onlinePolls / d.totalPolls) * 100 }))
        .sort((a: any, b: any) => b.upPct - a.upPct)
        .slice(0, 5);
      const list = sorted.map((d: any) =>
        `• **${d.hostname}** — ${d.upPct.toFixed(2)}% uptime`
      ).join('\n');
      return `🏆 **Devices with highest uptime:**\n\n${list}`;
    }

    if (q.includes('uptime') || q.includes('downtime') || q.includes('availability')) {
      const res = await devicesApi.list();
      const withData = res.data.filter((d: any) => (d.totalPolls ?? 0) > 0);
      if (withData.length === 0) return '📡 No poll data available yet. The ping monitor collects data every 5 seconds.';
      const avgUp = withData.reduce((s: number, d: any) => s + (d.onlinePolls / d.totalPolls) * 100, 0) / withData.length;
      const worstDevices = withData
        .map((d: any) => ({ ...d, upPct: (d.onlinePolls / d.totalPolls) * 100 }))
        .sort((a: any, b: any) => a.upPct - b.upPct)
        .slice(0, 3);
      const worstList = worstDevices.map((d: any) =>
        `• **${d.hostname}** — ${d.upPct.toFixed(2)}% uptime`
      ).join('\n');
      return `📶 **Network availability summary:**\n\nAverage uptime across ${withData.length} devices: **${avgUp.toFixed(2)}%**\n\n**Worst performing devices:**\n${worstList}`;
    }

    // ── Alert queries ──────────────────────────────────────────
    if (q.includes('critical') && (q.includes('alert') || q.includes('alarm'))) {
      const res = await alertsApi.list({ severity: 'critical', status: 'active' });
      const alerts = res.data;
      if (alerts.length === 0) return '✅ **No critical alerts** are active right now.';
      const list = alerts.slice(0, 8).map((a: any) =>
        `• **${a.title}** — ${a.device} (${a.site}) — ${a.duration}`
      ).join('\n');
      return `🚨 **${alerts.length} critical alert(s) active:**\n\n${list}`;
    }

    if (q.includes('alert') || q.includes('alarm') || q.includes('incident')) {
      const res = await alertsApi.list({ status: 'active' });
      const alerts = res.data;
      if (alerts.length === 0) return '✅ **No active alerts.** Network is operating normally.';
      const critical = alerts.filter((a: any) => a.severity === 'critical').length;
      const warning  = alerts.filter((a: any) => a.severity === 'warning').length;
      const info     = alerts.filter((a: any) => a.severity === 'info').length;
      const recent   = alerts.slice(0, 5).map((a: any) =>
        `• [${a.severity.toUpperCase()}] **${a.title}** — ${a.device}`
      ).join('\n');
      return `🔔 **${alerts.length} active alert(s):**\n\n• 🔴 Critical: ${critical}\n• ⚠️ Warning: ${warning}\n• ℹ️ Info: ${info}\n\n**Recent:**\n${recent}`;
    }

    if (q.includes('acknowledged') || q.includes('ack')) {
      const res = await alertsApi.list({ status: 'acknowledged' });
      const alerts = res.data;
      if (alerts.length === 0) return 'No acknowledged alerts at the moment.';
      const list = alerts.slice(0, 6).map((a: any) =>
        `• **${a.title}** — ${a.device} — acked by ${a.acknowledgedBy ?? 'unknown'}`
      ).join('\n');
      return `📋 **${alerts.length} acknowledged alert(s):**\n\n${list}`;
    }

    if (q.includes('resolved')) {
      const res = await alertsApi.list({ status: 'resolved' });
      const alerts = res.data;
      return `✅ **${alerts.length} resolved alert(s)** in the system.`;
    }

    // ── Log queries ────────────────────────────────────────────
    if (q.includes('error') && (q.includes('log') || q.includes('recent') || q.includes('last') || q.includes('show'))) {
      const res = await logsApi.list({ level: 'error', limit: '8' });
      const logs = res.data;
      if (logs.length === 0) return '✅ No recent error logs found.';
      const list = logs.slice(0, 6).map((l: any) =>
        `• **${l.source}** — ${l.message?.slice(0, 80)}`
      ).join('\n');
      return `❌ **Recent error logs:**\n\n${list}`;
    }

    if (q.includes('log') || q.includes('syslog') || q.includes('event')) {
      const res = await logsApi.list({ limit: '8' });
      const logs = res.data;
      if (logs.length === 0) return 'No logs available yet.';
      const list = logs.slice(0, 6).map((l: any) =>
        `• [${l.level?.toUpperCase()}] **${l.source}** — ${l.message?.slice(0, 70)}`
      ).join('\n');
      return `📋 **Recent log entries:**\n\n${list}`;
    }

    // ── Health / summary queries ───────────────────────────────
    if (q.includes('health') || q.includes('status') || q.includes('summary') || q.includes('overview') || q.includes('network') || q.includes('how is')) {
      const [devRes, alertRes] = await Promise.all([
        devicesApi.list(),
        alertsApi.list({ status: 'active' }),
      ]);
      const devices  = devRes.data;
      const alerts   = alertRes.data;
      const online   = devices.filter((d: any) => d.status === 'online').length;
      const offline  = devices.filter((d: any) => d.status === 'offline').length;
      const warning  = devices.filter((d: any) => d.status === 'warning').length;
      const critical = alerts.filter((a: any) => a.severity === 'critical').length;
      const health   = offline === 0 && critical === 0 ? '🟢 Healthy' : critical > 0 ? '🔴 Critical Issues' : '⚠️ Degraded';

      return `📊 **Network Health: ${health}**\n\n**Devices:**\n• Total: ${devices.length} | 🟢 Online: ${online} | 🔴 Offline: ${offline} | ⚠️ Warning: ${warning}\n\n**Active Alerts:**\n• Total: ${alerts.length} | 🔴 Critical: ${critical} | ⚠️ Warning: ${alerts.filter((a: any) => a.severity === 'warning').length}\n\n${offline > 0 ? `⚠️ ${offline} device(s) are currently unreachable.` : '✅ All devices are reachable.'}\n\nIs there anything specific you'd like me to look into?`;
    }

    // ── Job/Scheduler queries ─────────────────────────────────
    if (q.includes('job') || q.includes('schedule') || q.includes('task') || q.includes('automation')) {
      const res = await jobsApi.list();
      const jobs = res.data;
      const running = jobs.filter((j: any) => j.status === 'running').length;
      const enabled = jobs.filter((j: any) => j.enabled).length;
      const failed = jobs.filter((j: any) => j.status === 'failed').length;
      
      if (q.includes('running') || q.includes('active')) {
        const runningJobs = jobs.filter((j: any) => j.status === 'running');
        if (runningJobs.length === 0) return '✅ No jobs are currently running.';
        const list = runningJobs.map((j: any) => `• **${j.name}** — ${j.type}`).join('\n');
        return `🔄 **${runningJobs.length} job(s) currently running:**\n\n${list}`;
      }
      
      if (q.includes('failed')) {
        const failedJobs = jobs.filter((j: any) => j.status === 'failed');
        if (failedJobs.length === 0) return '✅ No failed jobs.';
        const list = failedJobs.map((j: any) => `• **${j.name}** — ${j.type}`).join('\n');
        return `❌ **${failedJobs.length} failed job(s):**\n\n${list}`;
      }

      const jobList = jobs.slice(0, 8).map((j: any) => 
        `• ${j.enabled ? '✅' : '⏸️'} **${j.name}** — ${j.type} (${j.status})`
      ).join('\n');
      
      return `📋 **Scheduled Jobs:**\n\n• Total: ${jobs.length} | 🟢 Enabled: ${enabled} | 🔄 Running: ${running} | ❌ Failed: ${failed}\n\n**Recent jobs:**\n${jobList}`;
    }

    // ── Asset queries ─────────────────────────────────────────
    if (q.includes('asset') || q.includes('inventory') || q.includes('equipment')) {
      const res = await assetsApi.list();
      const assets = res || [];
      if (assets.length === 0) return '📦 No assets found in inventory.';
      
      const byType: Record<string, number> = {};
      assets.forEach((a: any) => { byType[a.type] = (byType[a.type] ?? 0) + 1; });
      const typeList = Object.entries(byType).map(([t, n]) => `• ${t}: ${n}`).join('\n');
      
      return `📦 **Asset Inventory:**\n\n• Total assets: ${assets.length}\n\n**By type:**\n${typeList}\n\nWould you like details on any specific asset?`;
    }

    // ── User queries ───────────────────────────────────────────
    if (q.includes('user') || q.includes('admin') || q.includes('team') || q.includes('who')) {
      const res = await usersApi.list();
      const users = res.data || [];
      if (users.length === 0) return '👥 No users found.';
      
      const byRole: Record<string, number> = {};
      users.forEach((u: any) => { byRole[u.role] = (byRole[u.role] ?? 0) + 1; });
      const roleList = Object.entries(byRole).map(([r, n]) => `• ${r}: ${n}`).join('\n');
      const userList = users.slice(0, 6).map((u: any) => `• **${u.name}** — ${u.role}`).join('\n');
      
      return `👥 **User Management:**\n\n• Total users: ${users.length}\n\n**By role:**\n${roleList}\n\n**Users:**\n${userList}`;
    }

    // ── Conversational greetings ───────────────────────────────
    if (q.includes('hello') || q.includes('hi') || q.includes('hey') || q.includes('good morning') || q.includes('good afternoon')) {
      return `Hello! 👋 I'm here to help you monitor and manage your network infrastructure.\n\nI can help you with:\n• Checking device status and availability\n• Viewing alerts and incidents\n• Reviewing logs and events\n• Managing scheduled jobs\n• Asset inventory\n\nWhat would you like to know about your network today?`;
    }

    if (q.includes('thank') || q.includes('thanks')) {
      return `You're welcome! 😊 Let me know if you need anything else. I'm here 24/7 to help with your NMS operations.`;
    }

    if (q.includes('help') || q.includes('what can you do') || q.includes('capabilities')) {
      return `I'm your NMS AI Assistant with real-time access to your network data. Here's what I can help with:\n\n**🖥️ Devices:**\n• Check online/offline status\n• Analyze uptime and availability\n• Filter by site, type, vendor\n\n**🚨 Alerts:**\n• Show critical and active alerts\n• Alert history and trends\n• Acknowledged and resolved alerts\n\n**📋 Operations:**\n• Scheduled jobs status\n• Job failures and runs\n\n**📦 Assets:**\n• Inventory management\n• Equipment tracking\n\n**📊 Reports:**\n• Uptime and availability exports\n• Alert summaries\n\nJust ask me anything in natural language!`;
    }

    if (q.includes('problem') || q.includes('issue') || q.includes('wrong') || q.includes('error') || q.includes('not working')) {
      const [devRes, alertRes] = await Promise.all([
        devicesApi.list({ status: 'offline' }),
        alertsApi.list({ severity: 'critical', status: 'active' }),
      ]);
      const offline = devRes.data.length;
      const critical = alertRes.data.length;
      
      if (offline === 0 && critical === 0) {
        return `✅ Everything looks good! No critical issues detected.\n\nAll devices are online and there are no critical alerts. Is there something specific you're concerned about?`;
      }
      
      let response = '🔍 Here\'s what I found:\n\n';
      if (critical > 0) {
        response += `• ${critical} critical alert(s) need attention\n`;
      }
      if (offline > 0) {
        response += `• ${offline} device(s) are offline\n`;
      }
      response += `\nWould you like me to show you the details?`;
      return response;
    }

    // ── Specific device lookup ─────────────────────────────────
    const res = await devicesApi.list();
    const match = res.data.find((d: any) =>
      q.includes(d.hostname.toLowerCase()) || q.includes(d.ip)
    );
    if (match) {
      const total   = match.totalPolls  ?? 0;
      const online  = match.onlinePolls ?? 0;
      const upPct   = total > 0 ? ((online / total) * 100).toFixed(2) + '%' : 'N/A';
      return `🖥️ **${match.hostname}** (${match.ip})\n\n• Status: **${match.status.toUpperCase()}**\n• Type: ${match.type} | Vendor: ${match.vendor}\n• Site: ${match.site} | Location: ${match.location}\n• Uptime: ${match.uptime} | Uptime %: ${upPct}\n• Last seen: ${match.lastSeen ? new Date(match.lastSeen).toLocaleString() : 'unknown'}`;
    }

    // ── Fallback ───────────────────────────────────────────────
    return `I'm not sure I understood that completely. Could you rephrase it?\n\nHere are some things I can help with:\n• **Devices:** "show offline devices", "device count by site", "status of core-rtr-01"\n• **Alerts:** "show critical alerts", "how many active alerts"\n• **Logs:** "show recent errors"\n• **Health:** "network health summary", "how is my network"\n• **Jobs:** "show scheduled jobs", "any failed jobs"\n• **Assets:** "list all assets"\n\nOr just ask me anything in plain language!`;

  } catch (err) {
    return '⚠️ Unable to fetch data from the NMS backend. Please ensure the backend server is running on port 3001.';
  }
}

// ─── Component ────────────────────────────────────────────────
export default function AIAssistantPanel() {
  const { setAiPanelOpen } = useApp();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: "Hello! I'm the NMS AI Assistant. I have access to your live network data — devices, alerts, logs, and scheduled jobs.\n\nAsk me anything about your infrastructure!" }
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setMessages(m => [...m, { role: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    try {
      const reply = await processQuery(userMsg);
      setMessages(m => [...m, { role: 'ai', text: reply }]);
    } catch {
      setMessages(m => [...m, { role: 'ai', text: '⚠️ Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <div className="fixed inset-0 z-50" onClick={() => setAiPanelOpen(false)}>
      <div className="absolute inset-0 bg-black/50" />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-[440px] flex flex-col z-10 border-l border-white/8 shadow-glass"
        style={{ background: 'rgba(7,13,26,0.97)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Bot size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              NMS AI Assistant <Sparkles size={12} className="text-cyan-400" />
            </div>
            <div className="text-xs text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full live-indicator" />
              Live data
            </div>
          </div>
          <button onClick={() => setAiPanelOpen(false)} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                msg.role === 'ai'
                  ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white'
                  : 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white'
              }`}>
                {msg.role === 'ai' ? <Bot size={13} /> : 'U'}
              </div>
              <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                msg.role === 'ai'
                  ? 'bg-white/6 text-slate-200 rounded-tl-sm border border-white/8'
                  : 'bg-blue-600/30 text-blue-100 rounded-tr-sm border border-blue-500/20'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shrink-0">
                <Bot size={13} className="text-white" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white/6 border border-white/8 flex items-center gap-2">
                <Loader2 size={14} className="text-blue-400 animate-spin" />
                <span className="text-xs text-slate-400">Fetching live data...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions — only on first open */}
        {messages.length <= 1 && (
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button key={s} onClick={() => send(s)}
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-blue-500/15 hover:border-blue-500/30 hover:text-blue-300 transition-all">
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-white/8 p-4 shrink-0">
          <div className="flex gap-2 items-center bg-white/5 border border-white/10 rounded-xl px-3 py-2 focus-within:border-blue-500/40 transition-colors">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder="Ask about your network..."
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              className="p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Send size={13} />
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-1.5 text-center">Queries real-time NMS data</p>
        </div>
      </motion.div>
    </div>
  );
}
