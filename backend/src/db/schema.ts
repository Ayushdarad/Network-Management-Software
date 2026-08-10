import {
  mysqlTable, varchar, int, float, text,
  timestamp, boolean, json, mysqlEnum, index
} from 'drizzle-orm/mysql-core';

// ─── Devices ──────────────────────────────────────────────────────────────────
export const devices = mysqlTable('devices', {
  id: varchar('id', { length: 10 }).primaryKey(),
  hostname: varchar('hostname', { length: 100 }).notNull(),
  ip: varchar('ip', { length: 45 }).notNull(),
  type: mysqlEnum('type', ['router', 'switch', 'server', 'firewall', 'ap', 'load-balancer', 'storage', 'camera']).notNull(),
  vendor: varchar('vendor', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  location: varchar('location', { length: 100 }).notNull(),
  site: varchar('site', { length: 50 }).notNull(),
  status: mysqlEnum('status', ['online', 'offline', 'warning', 'unknown']).notNull().default('unknown'),
  os: varchar('os', { length: 100 }).notNull(),
  uptime: varchar('uptime', { length: 50 }).notNull().default('0d 0h'),
  cpu: float('cpu').notNull().default(0),
  memory: float('memory').notNull().default(0),
  disk: float('disk').notNull().default(0),
  lastSeen: timestamp('last_seen').notNull().defaultNow(),
  interfaces: int('interfaces').notNull().default(0),
  tags: json('tags').$type<string[]>().notNull().default([]),
  totalPolls: int('total_polls').notNull().default(0),
  onlinePolls: int('online_polls').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (t) => [
  index('idx_devices_status').on(t.status),
  index('idx_devices_site').on(t.site),
  index('idx_devices_type').on(t.type),
]);

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alerts = mysqlTable('alerts', {
  id: varchar('id', { length: 20 }).primaryKey(),
  severity: mysqlEnum('severity', ['critical', 'warning', 'info']).notNull(),
  status: mysqlEnum('status', ['active', 'acknowledged', 'resolved']).notNull().default('active'),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  device: varchar('device', { length: 100 }).notNull(),
  deviceIp: varchar('device_ip', { length: 45 }).notNull(),
  site: varchar('site', { length: 50 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  acknowledgedBy: varchar('acknowledged_by', { length: 100 }),
  assignedTo: varchar('assigned_to', { length: 100 }),
  duration: varchar('duration', { length: 30 }).notNull().default('0m'),
  count: int('count').notNull().default(1),
  rca: text('rca'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
}, (t) => [
  index('idx_alerts_severity').on(t.severity),
  index('idx_alerts_status').on(t.status),
  index('idx_alerts_site').on(t.site),
]);

// ─── Jobs ─────────────────────────────────────────────────────────────────────
export const jobs = mysqlTable('jobs', {
  id: varchar('id', { length: 20 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  type: varchar('type', { length: 100 }).notNull().default('Device Ping Check'),
  description: text('description'),
  targetDevice: varchar('target_device', { length: 100 }),
  frequency: varchar('frequency', { length: 50 }).notNull().default('Daily'),
  cron: varchar('cron', { length: 50 }),
  owner: varchar('owner', { length: 100 }),
  enabled: boolean('enabled').notNull().default(true),
  lastRun: timestamp('last_run'),
  nextRun: timestamp('next_run'),
  status: mysqlEnum('status', ['success', 'failed', 'running', 'paused', 'scheduled', 'enabled', 'disabled']).notNull().default('scheduled'),
  progress: int('progress'),
  duration: varchar('duration', { length: 30 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable('users', {
  id: int('id').primaryKey().autoincrement(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 150 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: mysqlEnum('role', ['admin', 'operator', 'viewer', 'security']).notNull().default('viewer'),
  status: mysqlEnum('status', ['active', 'inactive']).notNull().default('active'),
  isOnline: boolean('is_online').notNull().default(false),
  lastLogin: timestamp('last_login'),
  resetToken: varchar('reset_token', { length: 100 }),
  resetExpires: timestamp('reset_expires'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

// ─── Metrics (time-series snapshots) ──────────────────────────────────────────
export const metrics = mysqlTable('metrics', {
  id: int('id').primaryKey().autoincrement(),
  deviceId: varchar('device_id', { length: 10 }).notNull(),
  cpu: float('cpu').notNull(),
  memory: float('memory').notNull(),
  disk: float('disk').notNull(),
  inbound: float('inbound').notNull().default(0),   // Mbps
  outbound: float('outbound').notNull().default(0),  // Mbps
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('idx_metrics_device').on(t.deviceId),
  index('idx_metrics_created').on(t.createdAt),
]);

// ─── Syslog / Event Logs ──────────────────────────────────────────────────────
export const logs = mysqlTable('logs', {
  id: int('id').primaryKey().autoincrement(),
  level: mysqlEnum('level', ['debug', 'info', 'warning', 'error', 'critical']).notNull(),
  source: varchar('source', { length: 100 }).notNull(),
  sourceIp: varchar('source_ip', { length: 45 }),
  facility: varchar('facility', { length: 50 }),
  message: text('message').notNull(),
  raw: text('raw'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('idx_logs_level').on(t.level),
  index('idx_logs_source').on(t.source),
  index('idx_logs_created').on(t.createdAt),
]);

// ─── Topology Nodes ───────────────────────────────────────────────────────────
export const topologyNodes = mysqlTable('topology_nodes', {
  id: varchar('id', { length: 10 }).primaryKey(),
  deviceType: varchar('device_type', { length: 50 }).notNull(),
  posX: float('pos_x').notNull().default(0),
  posY: float('pos_y').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

// ─── Topology Edges ───────────────────────────────────────────────────────────
export const topologyEdges = mysqlTable('topology_edges', {
  id: varchar('id', { length: 20 }).primaryKey(),
  source: varchar('source', { length: 10 }).notNull(),
  target: varchar('target', { length: 10 }).notNull(),
  label: varchar('label', { length: 20 }),
  animated: boolean('animated').notNull().default(false),
  style: json('style').$type<Record<string, string | number>>(),
});

// ─── Assets ───────────────────────────────────────────────────────────────────
export const assets = mysqlTable('assets', {
  id: varchar('id', { length: 20 }).primaryKey(),
  name: varchar('name', { length: 150 }).notNull(),
  owner: varchar('owner', { length: 100 }).notNull(),
  status: mysqlEnum('status', ['active', 'review', 'expired']).notNull().default('review'),
  category: varchar('category', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogs = mysqlTable('audit_logs', {
  id: int('id').primaryKey().autoincrement(),
  userId: int('user_id'),
  userName: varchar('user_name', { length: 100 }),
  userRole: varchar('user_role', { length: 50 }),
  action: varchar('action', { length: 100 }).notNull(),
  resource: varchar('resource', { length: 200 }),
  method: varchar('method', { length: 10 }),
  path: varchar('path', { length: 255 }),
  ip: varchar('ip', { length: 45 }),
  result: mysqlEnum('result', ['success', 'failed']).notNull().default('success'),
  detail: text('detail'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('idx_audit_user').on(t.userId),
  index('idx_audit_created').on(t.createdAt),
]);

// ─── Device Timeline (UP/DOWN history) ────────────────────────────────────────
export const deviceTimeline = mysqlTable('device_timeline', {
  id: int('id').primaryKey().autoincrement(),
  deviceId: varchar('device_id', { length: 10 }).notNull(),
  hostname: varchar('hostname', { length: 100 }).notNull(),
  state: mysqlEnum('state', ['online', 'offline']).notNull(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
  durationSecs: int('duration_secs'),
  summary: varchar('summary', { length: 255 }),
}, (t) => [
  index('idx_timeline_device').on(t.deviceId),
  index('idx_timeline_started').on(t.startedAt),
  index('idx_timeline_ended').on(t.endedAt),
]);

