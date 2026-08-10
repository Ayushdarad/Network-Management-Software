import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';
import {
  LayoutDashboard, Bell, Server, History, BarChart2,
  Package, Archive, Activity,
  FileText, Calendar, Shield, HardDrive, ClipboardList, BarChart,
  Settings, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Bot, ScrollText, X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { can } from '../../lib/permissions';
import tecsidelLogo from '../../assets/Tecsidel Logo.jpg';

interface NavItem {
  label: string;
  icon: React.ElementType;
  path?: string;
  permission?: string;
  children?: { label: string; path: string; icon: React.ElementType; permission?: string }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', permission: 'dashboard.view' },
  {
    label: 'Monitoring', icon: Activity, children: [
      { label: 'Alerts', path: '/monitoring/alerts', icon: Bell, permission: 'alerts.view' },
      { label: 'Hosts & Services', path: '/monitoring/hosts', icon: Server, permission: 'devices.view' },
      { label: 'Availability Timeline', path: '/monitoring/timeline', icon: BarChart2, permission: 'devices.view' },
      { label: 'Host & Service History', path: '/monitoring/history', icon: History, permission: 'logs.view' },
    ]
  },
  {
    label: 'Inventory', icon: Package, children: [
      { label: 'Device Inventory', path: '/inventory/devices', icon: HardDrive, permission: 'devices.view' },
      { label: 'Asset Management', path: '/inventory/assets', icon: Archive, permission: 'inventory.view' },
    ]
  },
  {
    label: 'Logs & Events', icon: ScrollText, children: [
      { label: 'Event Timeline', path: '/logs/syslog', icon: FileText, permission: 'logs.view' },
      { label: 'Audit Logs', path: '/logs/audit', icon: Shield, permission: 'logs.view' },
    ]
  },
  {
    label: 'Operation Center', icon: ClipboardList, permission: 'jobs.view', children: [
      { label: 'Scheduler', path: '/operations/scheduler', icon: Calendar, permission: 'jobs.view' },
    ]
  },
  { label: 'Reports', icon: BarChart, path: '/reports', permission: 'reports.view' },
  { label: 'Settings', icon: Settings, path: '/settings', permission: 'settings.view' },
];

function NavGroup({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isChildActive = item.children?.some(c => location.pathname.startsWith(c.path));
  const [open, setOpen] = useState(isChildActive ?? false);
  const Icon = item.icon;

  if (collapsed) {
    return (
      <div className="relative group">
        <button
          onClick={() => item.children?.[0] && navigate(item.children[0].path)}
          title={item.label}
          className={cn('sidebar-link w-full justify-center px-0', isChildActive && 'active')}
        >
          <Icon size={18} className="shrink-0" />
        </button>
        <div className="absolute left-full top-0 ml-2 z-50 hidden group-hover:block w-52 glass shadow-glass rounded-xl py-1">
          <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-white/5 mb-1">{item.label}</div>
          {item.children?.map(child => (
            <NavLink key={child.path} to={child.path} onClick={onNavigate} className={({ isActive }) => cn('sidebar-link mx-1', isActive && 'active')}>
              <child.icon size={14} className="shrink-0" />
              {child.label}
            </NavLink>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('sidebar-link w-full', isChildActive && 'text-blue-400')}
      >
        <Icon size={18} className="shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-4 pl-3 border-l border-white/8 mt-0.5 space-y-0.5">
              {item.children?.map(child => (
                <NavLink
                  key={child.path}
                  to={child.path}
                  onClick={onNavigate}
                  className={({ isActive }) => cn('sidebar-link text-[13px]', isActive && 'active')}
                >
                  <child.icon size={14} className="shrink-0" />
                  {child.label}
                </NavLink>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, mobileMenuOpen, setMobileMenuOpen } = useApp();

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  // On mobile: fixed drawer. On desktop: static sidebar.
  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-white/6 shrink-0">
        <img src={tecsidelLogo} alt="Tecsidel" className="w-8 h-8 shrink-0 object-contain" />
        {(!sidebarCollapsed || isMobile) && (
          <div style={{ opacity: 1 }}>
            <div className="text-sm font-bold text-white leading-none">Tecsidel</div>
            <div className="text-[10px] font-medium text-blue-400 leading-none mt-0.5 tracking-wider">NMS Platform</div>
          </div>
        )}
        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-0.5">
        {navItems
          .filter(item => !item.permission || can(item.permission))
          .map(item => {
            const filteredItem = item.children
              ? { ...item, children: item.children.filter(c => !c.permission || can(c.permission)) }
              : item;
            if (filteredItem.children && filteredItem.children.length === 0) return null;
            const collapsed = isMobile ? false : sidebarCollapsed;
            return filteredItem.path ? (
              <NavLink
                key={filteredItem.path}
                to={filteredItem.path}
                title={collapsed ? filteredItem.label : undefined}
                onClick={handleNavClick}
                className={({ isActive }) => cn('sidebar-link', collapsed && 'justify-center px-0', isActive && 'active')}
              >
                <filteredItem.icon size={18} className="shrink-0" />
                {!collapsed && <span>{filteredItem.label}</span>}
              </NavLink>
            ) : (
              <NavGroup key={filteredItem.label} item={filteredItem} collapsed={collapsed} onNavigate={handleNavClick} />
            );
          })}
      </nav>

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <div className="border-t border-white/6 p-2 shrink-0">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/6 transition-all"
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span className="text-xs">Collapse</span></>}
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 h-full overflow-hidden border-r border-white/6 relative"
        style={{
          width: sidebarCollapsed ? 64 : 240,
          transition: 'width 0.2s ease',
          background: 'rgba(7,13,26,0.95)',
        }}
      >
        {sidebarContent(false)}
      </aside>

      {/* ── Mobile Drawer ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'tween', duration: 0.22 }}
            className="md:hidden fixed left-0 top-0 bottom-0 z-50 flex flex-col w-64 overflow-hidden border-r border-white/6"
            style={{ background: 'rgba(7,13,26,0.98)' }}
          >
            {sidebarContent(true)}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
