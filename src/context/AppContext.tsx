import React, { createContext, useContext, useState, useEffect } from 'react';
import { settingsApi } from '../lib/api';
import { loadPermissions } from '../lib/permissions';
import { getSharedSocket } from '../lib/socket';

export { getSharedSocket, disconnectSharedSocket } from '../lib/socket';

interface AppContextValue {
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (v: boolean) => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (v: boolean) => void;
  notificationsOpen: boolean;
  setNotificationsOpen: (v: boolean) => void;
  aiPanelOpen: boolean;
  setAiPanelOpen: (v: boolean) => void;
  activeAlerts: number;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('nms_theme') as 'dark' | 'light') || 'dark';
  });
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState(0);

  useEffect(() => {
    const socket = getSharedSocket();
    if (!socket) return;
    socket.on('alerts:count', (data) => { setActiveAlerts(data.activeAlerts); });
    return () => { socket.off('alerts:count'); };
  }, []);

  useEffect(() => {
    settingsApi.get().then(s => {
      if (s.permissions) loadPermissions(s.permissions);
    }).catch(() => { });
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'light') {
      html.classList.remove('dark');
      html.classList.add('light');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
    }
    localStorage.setItem('nms_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <AppContext.Provider value={{
      sidebarCollapsed, setSidebarCollapsed,
      mobileMenuOpen, setMobileMenuOpen,
      theme, toggleTheme,
      commandPaletteOpen, setCommandPaletteOpen,
      notificationsOpen, setNotificationsOpen,
      aiPanelOpen, setAiPanelOpen,
      activeAlerts,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
