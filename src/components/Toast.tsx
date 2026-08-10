import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

// ─── Global event bus ─────────────────────────────────────────
type Listener = (t: ToastItem) => void;
const listeners: Listener[] = [];

export function showToast(message: string, type: ToastType = 'info') {
  const item: ToastItem = { id: Date.now(), type, message };
  listeners.forEach(l => l(item));
}

// ─── Toast container (mount once in AppShell) ─────────────────
export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((t: ToastItem) => {
    setToasts(prev => [...prev, t]);
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 3500);
  }, []);

  useEffect(() => {
    listeners.push(add);
    return () => { const i = listeners.indexOf(add); if (i > -1) listeners.splice(i, 1); };
  }, [add]);

  const iconMap = { success: CheckCircle2, error: XCircle, info: Info };
  const colorMap = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    error:   'border-red-500/30 bg-red-500/10 text-red-400',
    info:    'border-blue-500/30 bg-blue-500/10 text-blue-400',
  };

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => {
          const Icon = iconMap[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border glass shadow-glass text-sm font-medium min-w-[260px] max-w-sm ${colorMap[t.type]}`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="flex-1 text-slate-200">{t.message}</span>
              <button onClick={() => setToasts(p => p.filter(x => x.id !== t.id))}
                className="text-slate-500 hover:text-white transition-colors shrink-0">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
