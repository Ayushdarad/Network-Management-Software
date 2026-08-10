import { getCurrentUser } from './api';

export type Role = 'admin' | 'operator' | 'viewer' | 'security';

export type Permission =
  | 'dashboard.view'
  | 'alerts.view' | 'alerts.acknowledge' | 'alerts.resolve' | 'alerts.delete'
  | 'devices.view' | 'devices.create' | 'devices.edit' | 'devices.delete' | 'devices.poll'
  | 'inventory.view' | 'inventory.edit'
  | 'logs.view'
  | 'reports.view' | 'reports.generate'
  | 'jobs.view' | 'jobs.run' | 'jobs.manage'
  | 'settings.view' | 'settings.edit'
  | 'users.view' | 'users.manage';

// ─── Default permission matrix ────────────────────────────────
export const DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'dashboard.view',
    'alerts.view', 'alerts.acknowledge', 'alerts.resolve', 'alerts.delete',
    'devices.view', 'devices.create', 'devices.edit', 'devices.delete', 'devices.poll',
    'inventory.view', 'inventory.edit',
    'logs.view',
    'reports.view', 'reports.generate',
    'jobs.view', 'jobs.run', 'jobs.manage',
    'settings.view', 'settings.edit',
    'users.view', 'users.manage',
  ],
  operator: [
    'dashboard.view',
    'alerts.view', 'alerts.acknowledge', 'alerts.resolve',
    'devices.view', 'devices.create', 'devices.edit', 'devices.poll',
    'inventory.view', 'inventory.edit',
    'logs.view',
    'reports.view', 'reports.generate',
    'jobs.view', 'jobs.run', 'jobs.manage',
  ],
  viewer: [
    'dashboard.view',
    'alerts.view',
    'devices.view',
    'inventory.view',
    'logs.view',
    'reports.view',
  ],
  security: [
    'reports.view', 'reports.generate',
  ],
};

// ─── Runtime store (loaded from settings API or defaults) ─────
let _permissions: Record<Role, Permission[]> = { ...DEFAULT_PERMISSIONS };

export function loadPermissions(saved: Record<string, string[]>) {
  const roles: Role[] = ['admin', 'operator', 'viewer', 'security'];
  roles.forEach(role => {
    if (saved[role]) _permissions[role] = saved[role] as Permission[];
  });
}

export function getPermissions(): Record<Role, Permission[]> {
  return _permissions;
}

export function getRole(): Role {
  const user = getCurrentUser();
  return (user?.role as Role) ?? 'viewer';
}

export function can(permission: Permission | string): boolean {
  const role = getRole();
  return _permissions[role]?.includes(permission as Permission) ?? false;
}

export function canAny(...permissions: string[]): boolean {
  return permissions.some(p => can(p));
}

// ─── Human-readable permission labels ─────────────────────────
export const PERMISSION_LABELS: Record<Permission, string> = {
  'dashboard.view':       'View Dashboard',
  'alerts.view':          'View Alerts',
  'alerts.acknowledge':   'Acknowledge Alerts',
  'alerts.resolve':       'Resolve Alerts',
  'alerts.delete':        'Delete Alerts',
  'devices.view':         'View Devices',
  'devices.create':       'Add Devices',
  'devices.edit':         'Edit Devices',
  'devices.delete':       'Delete Devices',
  'devices.poll':         'Poll Devices',
  'inventory.view':       'View Inventory',
  'inventory.edit':       'Edit Inventory',
  'logs.view':            'View Logs',
  'reports.view':         'View Reports',
  'reports.generate':     'Generate Reports',
  'jobs.view':            'View Jobs',
  'jobs.run':             'Run/Pause Jobs',
  'jobs.manage':          'Manage Jobs',
  'settings.view':        'View Settings',
  'settings.edit':        'Edit Settings',
  'users.view':           'View Users',
  'users.manage':         'Manage Users',
};

export const PERMISSION_GROUPS = [
  { label: 'Dashboard & Overview', perms: ['dashboard.view'] as Permission[] },
  { label: 'Alerts', perms: ['alerts.view', 'alerts.acknowledge', 'alerts.resolve', 'alerts.delete'] as Permission[] },
  { label: 'Devices', perms: ['devices.view', 'devices.create', 'devices.edit', 'devices.delete', 'devices.poll'] as Permission[] },
  { label: 'Inventory', perms: ['inventory.view', 'inventory.edit'] as Permission[] },
  { label: 'Logs & Reports', perms: ['logs.view', 'reports.view', 'reports.generate'] as Permission[] },
  { label: 'Operations', perms: ['jobs.view', 'jobs.run', 'jobs.manage'] as Permission[] },
  { label: 'Administration', perms: ['settings.view', 'settings.edit', 'users.view', 'users.manage'] as Permission[] },
];
