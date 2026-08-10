import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import { getSharedSocket } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { X, Bell, AlertTriangle, Info, CheckCircle, Clock, CheckCheck, ArrowRight } from 'lucide-react';
import { alertsApi } from '../../lib/api';
import { timeAgo } from '../../lib/utils';

const iconMap: Record<string, React.ElementType> = { critical: AlertTriangle, warning: AlertTriangle, info: Info };
const colorMap: Record<string, string> = { critical: 'text-red-400', warning: 'text-amber-400', info: 'text-blue-400' };
const bgMap: Record<string, string>    = { critical: 'bg-red-500/10',  warning: 'bg-amber-500/10',  info: 'bg-blue-500/10' };

export default function NotificationCenter() {
  const { setNotificationsOpen } = useApp();
  const navigate = useNavigate();
  const [recent, setRecent] = useState<any[]>([]);
  const [addressing, setAddressing] = useState<string | null>(null);

  const fetchAlerts = () => {
    alertsApi.list().then(res => setRecent(res.data.slice(0, 8))).catch(() => setRecent([]));
  };

  useEffect(() => {
    fetchAlerts();
    const socket = getSharedSocket();
    if (!socket) return;
    const handler = () => fetchAlerts();
    socket.on('alert:new',     handler);
    socket.on('alert:updated', handler);
    socket.on('alerts:count',  handler);
    return () => {
      socket.off('alert:new',     handler);
      socket.off('alert:updated', handler);
      socket.off('alerts:count',  handler);
    };
  }, []);

  const handleAddress = async (e: React.MouseEvent, alert: any) => {
    e.stopPropagation();
    setAddressing(alert.id);
    try {
      if (alert.status === 'active') {
        await alertsApi.acknowledge(alert.id);
      } else if (alert.status === 'acknowledged') {
        await alertsApi.resolve(alert.id);
      }
      fetchAlerts();
    } catch {/* ignore */} finally {
      setAddressing(null);
    }
  };

  const handleViewAll = () => {
    setNotificationsOpen(false);
    navigate('/monitoring/alerts');
  };

  const activeCount = recent.filter(a => a.status === 'active').length;

  return (
    <div className="fixed inset-0 z-50" onClick={() => setNotificationsOpen(false)}>
      <div className="absolute inset-0 bg-black/50" />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        className="absolute right-0 top-0 h-full w-96 glass border-l border-white/8 flex flex-col shadow-glass z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-blue-400" />
            <span className="font-semibold text-white">Notifications</span>
            {activeCount > 0 && (
              <span className="badge badge-critical ml-1">{activeCount} active</span>
            )}
          </div>
          <button onClick={() => setNotificationsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Alert list */}
        <div className="flex-1 overflow-y-auto py-2">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Bell size={28} className="mb-2 opacity-30" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : recent.map((alert) => {
            const Icon = iconMap[alert.severity] ?? Info;
            const isResolved = alert.status === 'resolved';
            const isAcknowledged = alert.status === 'acknowledged';
            const canAddress = !isResolved;

            return (
              <div
                key={alert.id}
                className="flex gap-3 px-4 py-3 hover:bg-white/4 transition-colors border-b border-white/4"
              >
                <div className={`w-8 h-8 rounded-lg ${bgMap[alert.severity] ?? 'bg-slate-500/10'} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon size={14} className={colorMap[alert.severity] ?? 'text-slate-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <span className="text-sm font-medium text-white truncate">{alert.title}</span>
                    {isResolved
                      ? <CheckCircle size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                      : isAcknowledged
                      ? <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium shrink-0">ACK</span>
                      : null
                    }
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">{alert.device} — {alert.description?.slice(0, 60)}...</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1 text-[11px] text-slate-600">
                      <Clock size={10} />
                      {timeAgo(alert.createdAt ?? alert.timestamp)}
                      <span className="mx-1">·</span>
                      <span>{alert.site}</span>
                    </div>
                    {canAddress && (
                      <button
                        onClick={e => handleAddress(e, alert)}
                        disabled={addressing === alert.id}
                        className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20 disabled:opacity-50 shrink-0"
                      >
                        <CheckCheck size={10} />
                        {addressing === alert.id
                          ? 'Working...'
                          : isAcknowledged ? 'Resolve' : 'Address'
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-white/8 p-4">
          <button
            onClick={handleViewAll}
            className="w-full py-2.5 rounded-lg bg-blue-600/20 text-blue-400 text-sm font-medium hover:bg-blue-600/30 transition-all border border-blue-500/20 flex items-center justify-center gap-2"
          >
            View All Alerts <ArrowRight size={14} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
