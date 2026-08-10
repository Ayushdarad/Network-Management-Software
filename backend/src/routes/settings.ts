import { Router } from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

const __dir = dirname(fileURLToPath(import.meta.url));
const SETTINGS_FILE = join(__dir, '../../settings.json');

// ─── Default permission matrix ────────────────────────────────
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'dashboard.view','alerts.view','alerts.acknowledge','alerts.resolve','alerts.delete',
    'devices.view','devices.create','devices.edit','devices.delete','devices.poll',
    'inventory.view','inventory.edit','logs.view','reports.view','reports.generate',
    'jobs.view','jobs.run','jobs.manage','settings.view','settings.edit',
    'users.view','users.manage','performance.view',
  ],
  operator: [
    'dashboard.view','alerts.view','alerts.acknowledge','alerts.resolve',
    'devices.view','devices.create','devices.edit','devices.poll',
    'inventory.view','inventory.edit','logs.view','reports.view','reports.generate',
    'jobs.view','jobs.run','jobs.manage','performance.view',
  ],
  viewer: [
    'dashboard.view','alerts.view','devices.view','inventory.view',
    'logs.view','reports.view','performance.view',
  ],
  security: [
    'dashboard.view','alerts.view','alerts.acknowledge','alerts.resolve',
    'devices.view','inventory.view','logs.view','reports.view','reports.generate',
    'performance.view',
  ],
};

const DEFAULT_SETTINGS: Record<string, any> = {
  platformName:     'Tecsidel NMS',
  organization:     'Tecsidel S.A.',
  timezone:         'UTC+5:30',
  pollInterval:     5,
  cpuThreshold:     80,
  memoryThreshold:  85,
  diskThreshold:    90,
  emailAlerts:      true,
  autoDiscovery:    true,
  auditLogging:     true,
  sessionTimeout:   30,
  metricsRetention: 90,
  logRetention:     180,
  alertRetention:   365,
  permissions:      DEFAULT_PERMISSIONS,
};

// ─── Load from file or use defaults ───────────────────────────
function loadStore(): Record<string, any> {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const raw = readFileSync(SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveStore(store: Record<string, any>) {
  try {
    writeFileSync(SETTINGS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Settings] Failed to persist:', e);
  }
}

let settingsStore = loadStore();

// ─── Export getter for use in scheduler/pingMonitor ───────────
export function getSetting<T>(key: string, fallback: T): T {
  return settingsStore[key] ?? fallback;
}

export function getRolePermissions(role: string): string[] {
  return settingsStore.permissions?.[role] ?? DEFAULT_PERMISSIONS[role] ?? [];
}

export function roleHasPermission(role: string, permission: string): boolean {
  return getRolePermissions(role).includes(permission);
}

// GET /api/settings
router.get('/', requirePermission('settings.view'), (_req, res) => {
  res.json(settingsStore);
});

import { reloadScheduler } from '../scheduler.js';

// PUT /api/settings
router.put('/', requirePermission('settings.edit'), async (req: AuthRequest, res) => {
  const allowed = [
    'platformName','organization','timezone','pollInterval',
    'cpuThreshold','memoryThreshold','diskThreshold',
    'emailAlerts','autoDiscovery','auditLogging','sessionTimeout',
    'metricsRetention','logRetention','alertRetention',
  ];
  const updates: Record<string, any> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  settingsStore = { ...settingsStore, ...updates };
  saveStore(settingsStore);
  
  // Reload the scheduler to pick up changes like pollInterval immediately
  await reloadScheduler();
  
  res.json(settingsStore);
});

// PUT /api/settings/permissions
router.put('/permissions', requirePermission('settings.edit'), (req: AuthRequest, res) => {
  const roles = ['admin', 'operator', 'viewer', 'security'];
  const updated: Record<string, string[]> = {};
  for (const role of roles) {
    if (Array.isArray(req.body[role])) updated[role] = req.body[role];
  }
  settingsStore.permissions = { ...settingsStore.permissions, ...updated };
  saveStore(settingsStore);
  res.json({ permissions: settingsStore.permissions });
});

export default router;
