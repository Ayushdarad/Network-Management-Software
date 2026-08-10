import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import {
  Bell, Sun, Moon, ChevronDown,
  RefreshCw, Bot, Clock, LogOut, UserCircle, Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import GlobalSearchInput from './GlobalSearchInput';
import { authApi } from '../../lib/api';

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  monitoring: 'Monitoring', alerts: 'Alerts', hosts: 'Hosts & Services',
  history: 'Host & Service History',
  inventory: 'Inventory', devices: 'Device Inventory', assets: 'Asset Management',
  logs: 'Logs & Events', syslog: 'Event Timeline', audit: 'Audit Logs',
  operations: 'Operation Center', scheduler: 'Scheduler',
  reports: 'Reports & Analytics', settings: 'Settings',
};

// ─── Memoized — only re-renders on route change ───────────────
const Breadcrumbs = memo(function Breadcrumbs() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean);
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500">
      <span className="text-slate-400">Tecsidel NMS</span>
      {parts.map((part, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="text-slate-600">/</span>
          <span className={i === parts.length - 1 ? 'text-slate-300 font-medium' : 'text-slate-500'}>
            {breadcrumbMap[part] ?? part}
          </span>
        </span>
      ))}
    </div>
  );
});

// ─── Clock: isolated so only the clock re-renders every second ─
const LiveClock = memo(function LiveClock() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Use DOM mutation directly — zero React re-renders
    const tick = () => {
      if (ref.current) {
        ref.current.textContent = new Date().toLocaleTimeString('en-GB', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 font-mono">
      <Clock size={12} />
      <span ref={ref} />
      <span className="ml-1 text-slate-600">UTC+5:30</span>
    </div>
  );
});

export default function TopBar() {
  const { theme, toggleTheme, setNotificationsOpen, setAiPanelOpen, activeAlerts, mobileMenuOpen, setMobileMenuOpen } = useApp();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const navigate = useNavigate();

  // Parse user once — not on every render
  const currentUser = useRef<any>(null);
  if (!currentUser.current) {
    try { currentUser.current = JSON.parse(localStorage.getItem('nms_user') || 'null'); } catch {}
  }
  const user = currentUser.current;

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'NMS';
  const firstName = user?.name?.split(' ')[0]?.toLowerCase() ?? 'user';

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.location.reload();
  }, []);

  const handleUserAction = useCallback((action: string) => {
    setUserMenuOpen(false);
    if (action === 'Profile') navigate('/settings');
    if (action === 'Sign Out') {
      // Call authApi.logout() so the backend marks this user as offline
      authApi.logout(); // async, handles nav internally
    }
  }, [navigate]);

  return (
    <header
      className="h-14 flex items-center px-3 md:px-4 gap-2 md:gap-3 border-b border-white/6 shrink-0 relative z-30"
      style={{ background: 'rgba(7,13,26,0.95)' }}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all shrink-0"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Breadcrumbs — only re-renders on route change */}
      <div className="flex-1 min-w-0 hidden sm:block">
        <Breadcrumbs />
      </div>
      <div className="flex-1 min-w-0 sm:hidden">
        <span className="text-sm font-semibold text-white">Tecsidel NMS</span>
      </div>

      {/* Global search */}
      <GlobalSearchInput />

      {/* Clock — DOM-mutated, zero React re-renders */}
      <LiveClock />

      {/* Refresh */}
      <button onClick={handleRefresh} title="Refresh data"
        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/6 transition-all">
        <RefreshCw size={15} className={cn(refreshing && 'animate-spin')} />
      </button>

      {/* Theme toggle */}
      <button onClick={toggleTheme} title="Toggle theme"
        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/6 transition-all">
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* AI Assistant */}
      <button onClick={() => setAiPanelOpen(true)} title="AI Assistant"
        className="p-2 rounded-lg text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 transition-all relative">
        <Bot size={16} />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-400 rounded-full live-indicator" />
      </button>

      {/* Notifications */}
      <button onClick={() => setNotificationsOpen(true)} title="Notifications"
        className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/6 transition-all">
        <Bell size={16} />
        {activeAlerts > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {activeAlerts}
          </span>
        )}
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setUserMenuOpen(o => !o)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/6 transition-all"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
            {initials}
          </div>
          <span className="hidden sm:block text-sm font-medium text-slate-300">{firstName}</span>
          <ChevronDown size={14} className="text-slate-500" />
        </button>

        <AnimatePresence>
          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-52 glass shadow-glass rounded-xl py-1.5 z-50"
              >
                <div className="px-4 py-2 border-b border-white/6 mb-1">
                  <div className="text-sm font-semibold text-white">{user?.name ?? 'NMS User'}</div>
                  <div className="text-xs text-slate-400 capitalize">{user?.role ?? 'viewer'}</div>
                </div>
                <button
                  onClick={() => handleUserAction('Profile')}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-white/6 hover:text-white transition-all"
                >
                  <UserCircle size={14} />
                  Profile & Settings
                </button>
                <div className="border-t border-white/6 mt-1 pt-1">
                  <button
                    onClick={() => handleUserAction('Sign Out')}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
