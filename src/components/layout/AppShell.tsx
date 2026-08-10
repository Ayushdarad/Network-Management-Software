import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import NotificationCenter from './NotificationCenter';
import AIAssistantPanel from './AIAssistantPanel';
import ToastContainer from '../Toast';
import { AnimatePresence, motion } from 'framer-motion';

export default function AppShell() {
  const { notificationsOpen, aiPanelOpen, mobileMenuOpen, setMobileMenuOpen } = useApp();
  const location = useLocation();

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-5 space-y-3 md:space-y-5">
          <Outlet />
        </main>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {notificationsOpen && <NotificationCenter />}
        {aiPanelOpen && <AIAssistantPanel />}
      </AnimatePresence>
      <ToastContainer />
    </div>
  );
}
