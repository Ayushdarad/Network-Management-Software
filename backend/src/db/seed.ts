/**
 * Database seeder — loads all existing mock data into MySQL.
 * Run with: npm run db:seed
 */

// Load env vars before anything else
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
} catch { /* .env optional */ }

import { db } from './connection.js';
import {
  devices, alerts, jobs, users, metrics,
  topologyNodes, topologyEdges, logs
} from './schema.js';
import bcrypt from 'bcryptjs';

// ─── Seed Data (mirrors frontend mock files) ──────────────────────────────────

const devicesSeed = [
  { id: 'D001', hostname: 'core-rtr-01', ip: '10.0.0.1', type: 'router' as const, vendor: 'Cisco', model: 'ASR 9001', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'IOS-XR 7.5', uptime: '142d 6h', cpu: 18, memory: 42, disk: 30, interfaces: 24, tags: ['core', 'mpls', 'critical'] },
  { id: 'D002', hostname: 'core-rtr-02', ip: '10.0.0.2', type: 'router' as const, vendor: 'Cisco', model: 'ASR 9001', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'IOS-XR 7.5', uptime: '141d 2h', cpu: 22, memory: 38, disk: 28, interfaces: 24, tags: ['core', 'mpls'] },
  { id: 'D003', hostname: 'dist-sw-01', ip: '10.0.1.1', type: 'switch' as const, vendor: 'Cisco', model: 'Catalyst 9500', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'IOS-XE 17.9', uptime: '98d 14h', cpu: 12, memory: 31, disk: 15, interfaces: 48, tags: ['distribution', 'vlan'] },
  { id: 'D004', hostname: 'dist-sw-02', ip: '10.0.1.2', type: 'switch' as const, vendor: 'Cisco', model: 'Catalyst 9500', location: 'Madrid DC', site: 'SITE-MAD', status: 'warning' as const, os: 'IOS-XE 17.9', uptime: '98d 12h', cpu: 78, memory: 85, disk: 60, interfaces: 48, tags: ['distribution', 'vlan', 'high-cpu'] },
  { id: 'D005', hostname: 'fw-primary', ip: '10.0.2.1', type: 'firewall' as const, vendor: 'Palo Alto', model: 'PA-5250', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'PAN-OS 11.0', uptime: '200d 3h', cpu: 35, memory: 55, disk: 42, interfaces: 16, tags: ['security', 'perimeter', 'critical'] },
  { id: 'D006', hostname: 'fw-secondary', ip: '10.0.2.2', type: 'firewall' as const, vendor: 'Palo Alto', model: 'PA-5250', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'PAN-OS 11.0', uptime: '200d 1h', cpu: 32, memory: 52, disk: 40, interfaces: 16, tags: ['security', 'perimeter'] },
  { id: 'D007', hostname: 'app-srv-01', ip: '10.1.0.10', type: 'server' as const, vendor: 'Dell', model: 'PowerEdge R750', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'RHEL 9.2', uptime: '65d 8h', cpu: 45, memory: 67, disk: 72, interfaces: 4, tags: ['application', 'production'] },
  { id: 'D008', hostname: 'app-srv-02', ip: '10.1.0.11', type: 'server' as const, vendor: 'Dell', model: 'PowerEdge R750', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'RHEL 9.2', uptime: '65d 7h', cpu: 52, memory: 71, disk: 68, interfaces: 4, tags: ['application', 'production'] },
  { id: 'D009', hostname: 'db-srv-01', ip: '10.1.1.10', type: 'server' as const, vendor: 'HPE', model: 'ProLiant DL380', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'RHEL 9.2', uptime: '120d 4h', cpu: 38, memory: 82, disk: 89, interfaces: 4, tags: ['database', 'production', 'critical'] },
  { id: 'D010', hostname: 'db-srv-02', ip: '10.1.1.11', type: 'server' as const, vendor: 'HPE', model: 'ProLiant DL380', location: 'Madrid DC', site: 'SITE-MAD', status: 'offline' as const, os: 'RHEL 9.2', uptime: '0d 0h', cpu: 0, memory: 0, disk: 0, interfaces: 4, tags: ['database', 'production'] },
  { id: 'D011', hostname: 'lb-01', ip: '10.0.3.1', type: 'load-balancer' as const, vendor: 'F5', model: 'BIG-IP 2000s', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'TMOS 16.1', uptime: '180d 2h', cpu: 28, memory: 44, disk: 35, interfaces: 8, tags: ['load-balancing', 'critical'] },
  { id: 'D012', hostname: 'brc-rtr-01', ip: '10.10.0.1', type: 'router' as const, vendor: 'Juniper', model: 'MX204', location: 'Barcelona', site: 'SITE-BCN', status: 'online' as const, os: 'Junos 22.4', uptime: '88d 16h', cpu: 15, memory: 36, disk: 22, interfaces: 12, tags: ['branch', 'wan'] },
  { id: 'D013', hostname: 'brc-sw-01', ip: '10.10.1.1', type: 'switch' as const, vendor: 'Juniper', model: 'EX4300', location: 'Barcelona', site: 'SITE-BCN', status: 'online' as const, os: 'Junos 21.2', uptime: '90d 5h', cpu: 9, memory: 28, disk: 18, interfaces: 48, tags: ['branch', 'access'] },
  { id: 'D014', hostname: 'lon-rtr-01', ip: '10.20.0.1', type: 'router' as const, vendor: 'Cisco', model: 'ISR 4451', location: 'London', site: 'SITE-LON', status: 'warning' as const, os: 'IOS-XE 17.6', uptime: '55d 9h', cpu: 81, memory: 76, disk: 45, interfaces: 8, tags: ['branch', 'wan', 'high-cpu'] },
  { id: 'D015', hostname: 'storage-01', ip: '10.1.2.10', type: 'storage' as const, vendor: 'NetApp', model: 'AFF A400', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'ONTAP 9.12', uptime: '300d 18h', cpu: 22, memory: 48, disk: 91, interfaces: 8, tags: ['storage', 'san', 'critical'] },
  { id: 'D016', hostname: 'ap-floor1-01', ip: '192.168.1.10', type: 'ap' as const, vendor: 'Cisco', model: 'Aironet 2800', location: 'Madrid HQ', site: 'SITE-MAD-HQ', status: 'online' as const, os: 'AireOS 8.10', uptime: '33d 12h', cpu: 5, memory: 22, disk: 10, interfaces: 2, tags: ['wireless', 'floor1'] },
  { id: 'D017', hostname: 'ap-floor2-01', ip: '192.168.2.10', type: 'ap' as const, vendor: 'Cisco', model: 'Aironet 2800', location: 'Madrid HQ', site: 'SITE-MAD-HQ', status: 'unknown' as const, os: 'AireOS 8.10', uptime: '?', cpu: 0, memory: 0, disk: 0, interfaces: 2, tags: ['wireless', 'floor2'] },
  { id: 'D018', hostname: 'par-rtr-01', ip: '10.30.0.1', type: 'router' as const, vendor: 'Huawei', model: 'NE40E-X8', location: 'Paris', site: 'SITE-PAR', status: 'online' as const, os: 'VRP 8.21', uptime: '77d 3h', cpu: 20, memory: 41, disk: 28, interfaces: 16, tags: ['branch', 'wan'] },
  { id: 'D019', hostname: 'mon-srv-01', ip: '10.1.3.10', type: 'server' as const, vendor: 'Dell', model: 'PowerEdge R640', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'Ubuntu 22.04', uptime: '200d 12h', cpu: 32, memory: 58, disk: 55, interfaces: 2, tags: ['monitoring', 'nms', 'critical'] },
  { id: 'D020', hostname: 'vpn-gw-01', ip: '10.0.4.1', type: 'firewall' as const, vendor: 'Fortinet', model: 'FortiGate 200E', location: 'Madrid DC', site: 'SITE-MAD', status: 'online' as const, os: 'FortiOS 7.4', uptime: '155d 6h', cpu: 42, memory: 58, disk: 38, interfaces: 12, tags: ['vpn', 'security'] },
];

const alertsSeed = [
  { id: 'ALT-0042', severity: 'critical' as const, status: 'active' as const, title: 'Host Unreachable', description: 'db-srv-02 has stopped responding to ICMP ping.', device: 'db-srv-02', deviceIp: '10.1.1.11', site: 'SITE-MAD', category: 'Availability', duration: '3h 31m', count: 1, rca: 'Network interface eth0 went down due to hardware failure.' },
  { id: 'ALT-0043', severity: 'critical' as const, status: 'active' as const, title: 'High CPU Utilization', description: 'dist-sw-02 CPU at 78% for 25 minutes.', device: 'dist-sw-02', deviceIp: '10.0.1.2', site: 'SITE-MAD', category: 'Performance', duration: '25m', count: 4, rca: 'Unusually high broadcast traffic on VLAN 20.' },
  { id: 'ALT-0044', severity: 'critical' as const, status: 'acknowledged' as const, title: 'High CPU Utilization', description: 'lon-rtr-01 CPU utilization reached 81%.', device: 'lon-rtr-01', deviceIp: '10.20.0.1', site: 'SITE-LON', category: 'Performance', acknowledgedBy: 'j.garcia', assignedTo: 'n.okonkwo', duration: '1h 01m', count: 6 },
  { id: 'ALT-0045', severity: 'warning' as const, status: 'active' as const, title: 'Disk Usage High', description: 'storage-01 disk capacity at 91%.', device: 'storage-01', deviceIp: '10.1.2.10', site: 'SITE-MAD', category: 'Capacity', duration: '2h 38m', count: 2 },
  { id: 'ALT-0046', severity: 'warning' as const, status: 'active' as const, title: 'Memory Utilization High', description: 'db-srv-01 memory at 82%.', device: 'db-srv-01', deviceIp: '10.1.1.10', site: 'SITE-MAD', category: 'Performance', duration: '1h 23m', count: 3 },
  { id: 'ALT-0047', severity: 'warning' as const, status: 'active' as const, title: 'Interface Down', description: 'ap-floor2-01 lost connectivity.', device: 'ap-floor2-01', deviceIp: '192.168.2.10', site: 'SITE-MAD-HQ', category: 'Availability', duration: '48m', count: 1 },
  { id: 'ALT-0048', severity: 'info' as const, status: 'acknowledged' as const, title: 'Config Change Detected', description: 'Unauthorized config change on fw-primary.', device: 'fw-primary', deviceIp: '10.0.2.1', site: 'SITE-MAD', category: 'Security', acknowledgedBy: 'admin', duration: '4h 13m', count: 1 },
  { id: 'ALT-0049', severity: 'info' as const, status: 'active' as const, title: 'BGP Peer Flap', description: 'brc-rtr-01 BGP peer flapped 3 times.', device: 'brc-rtr-01', deviceIp: '10.10.0.1', site: 'SITE-BCN', category: 'Routing', duration: '33m', count: 3 },
  { id: 'ALT-0050', severity: 'critical' as const, status: 'resolved' as const, title: 'Link Down: Uplink', description: 'dist-sw-01 uplink GE0/0/0 went down.', device: 'dist-sw-01', deviceIp: '10.0.1.1', site: 'SITE-MAD', category: 'Availability', duration: '12m', count: 1, rca: 'Fiber cable loose in patch panel bay 3.' },
  { id: 'ALT-0051', severity: 'warning' as const, status: 'resolved' as const, title: 'NTP Sync Failure', description: 'par-rtr-01 failed to sync with NTP server.', device: 'par-rtr-01', deviceIp: '10.30.0.1', site: 'SITE-PAR', category: 'Configuration', duration: '10m', count: 1 },
  { id: 'ALT-0052', severity: 'warning' as const, status: 'active' as const, title: 'High Traffic Threshold', description: 'lb-01 WAN interface at 94% utilization.', device: 'lb-01', deviceIp: '10.0.3.1', site: 'SITE-MAD', category: 'Performance', duration: '15m', count: 5 },
  { id: 'ALT-0053', severity: 'info' as const, status: 'active' as const, title: 'SSL Certificate Expiry', description: 'fw-secondary SSL certificate expires in 14 days.', device: 'fw-secondary', deviceIp: '10.0.2.2', site: 'SITE-MAD', category: 'Security', duration: '11h 43m', count: 1 },
  { id: 'ALT-0054', severity: 'info' as const, status: 'active' as const, title: 'Scheduled Maintenance', description: 'mon-srv-01 scheduled maintenance window starts in 2 hours.', device: 'mon-srv-01', deviceIp: '10.1.3.10', site: 'SITE-MAD', category: 'Maintenance', duration: '43m', count: 1 },
];

const jobsSeed = [
  { id: 'JOB-001', name: 'Device Ping Check', type: 'Device Ping Check' as const, description: 'ICMP availability check for all managed devices.', frequency: 'Every 30 minutes', cron: '*/30 * * * *', owner: 'admin', status: 'success' as const, duration: '4m 32s', enabled: true },
  { id: 'JOB-002', name: 'Config Backup - Core Devices', type: 'Config Backup' as const, description: 'Config backup for all core routers and switches.', frequency: 'Daily', cron: '0 1 * * *', owner: 'admin', status: 'success' as const, duration: '2m 14s', enabled: true },
  { id: 'JOB-003', name: 'Compliance Check - CIS', type: 'Compliance Scan' as const, description: 'CIS Benchmark compliance checks on all managed devices.', frequency: 'Weekly', cron: '0 3 * * 0', owner: 'j.garcia', status: 'success' as const, duration: '18m 05s', enabled: true },
  { id: 'JOB-004', name: 'Uptime Report - Monthly', type: 'Performance Report' as const, description: 'Monthly uptime and availability report.', frequency: 'Monthly', cron: '0 6 1 * *', owner: 'n.okonkwo', status: 'success' as const, duration: '6m 48s', enabled: true },
  { id: 'JOB-005', name: 'Device Ping Check - Branch Sites', type: 'Device Ping Check' as const, description: 'ICMP check for branch site devices.', frequency: 'Every 6 hours', cron: '0 */6 * * *', owner: 'admin', status: 'scheduled' as const, enabled: true },
  { id: 'JOB-006', name: 'Log Cleanup', type: 'Compliance Scan' as const, description: 'Purge logs older than retention policy.', frequency: 'Every 4 hours', cron: '0 */4 * * *', owner: 'admin', status: 'success' as const, duration: '1m 22s', enabled: false },
  { id: 'JOB-007', name: 'Config Backup - Branch Sites', type: 'Config Backup' as const, description: 'Config backup for all branch site devices.', frequency: 'Daily', cron: '0 3 * * *', owner: 'admin', status: 'failed' as const, duration: '5m 11s', enabled: true },
  { id: 'JOB-008', name: 'Performance Report - Weekly', type: 'Performance Report' as const, description: 'Weekly availability summary report.', frequency: 'Weekly', cron: '0 7 * * 1', owner: 'j.garcia', status: 'scheduled' as const, enabled: true },
  { id: 'JOB-009', name: 'Device Ping Check - SITE-LON', type: 'Device Ping Check' as const, description: 'ICMP check for London site devices.', frequency: 'Every 12 hours', cron: '0 */12 * * *', owner: 'admin', status: 'success' as const, duration: '3m 07s', enabled: true },
  { id: 'JOB-010', name: 'Firewall Compliance', type: 'Compliance Scan' as const, description: 'Verify firewall rule compliance.', frequency: 'Daily', cron: '0 4 * * *', owner: 'security-team', status: 'paused' as const, enabled: false },
];

const usersSeed = [
  { name: 'Admin User', email: 'admin@tecsidel.com', password: 'admin123', role: 'admin' as const },
  { name: 'Juan Garcia', email: 'j.garcia@tecsidel.com', password: 'pass1234', role: 'operator' as const },
  { name: 'Nkechi Okonkwo', email: 'n.okonkwo@tecsidel.com', password: 'pass1234', role: 'operator' as const },
  { name: 'Thomas Brauer', email: 't.brauer@tecsidel.com', password: 'pass1234', role: 'viewer' as const },
  { name: 'Security Team', email: 'security@tecsidel.com', password: 'pass1234', role: 'security' as const },
];

const topologyNodesSeed = [
  { id: 'D001', deviceType: 'router', posX: 400, posY: 50 },
  { id: 'D002', deviceType: 'router', posX: 650, posY: 50 },
  { id: 'D003', deviceType: 'switch', posX: 300, posY: 220 },
  { id: 'D004', deviceType: 'switch', posX: 550, posY: 220 },
  { id: 'D005', deviceType: 'firewall', posX: 80, posY: 200 },
  { id: 'D006', deviceType: 'firewall', posX: 80, posY: 320 },
  { id: 'D007', deviceType: 'server', posX: 200, posY: 400 },
  { id: 'D008', deviceType: 'server', posX: 380, posY: 400 },
  { id: 'D009', deviceType: 'server', posX: 560, posY: 400 },
  { id: 'D010', deviceType: 'server', posX: 720, posY: 400 },
  { id: 'D011', deviceType: 'load-balancer', posX: 750, posY: 220 },
  { id: 'D015', deviceType: 'storage', posX: 900, posY: 400 },
];

const topologyEdgesSeed = [
  { id: 'e1-3', source: 'D001', target: 'D003', label: '10G', animated: true },
  { id: 'e1-4', source: 'D001', target: 'D004', label: '10G', animated: true },
  { id: 'e2-3', source: 'D002', target: 'D003', label: '10G', animated: true },
  { id: 'e2-4', source: 'D002', target: 'D004', label: '10G', animated: true },
  { id: 'e1-5', source: 'D001', target: 'D005', label: '1G', animated: false },
  { id: 'e2-6', source: 'D002', target: 'D006', label: '1G', animated: false },
  { id: 'e2-11', source: 'D002', target: 'D011', label: '10G', animated: true },
  { id: 'e3-7', source: 'D003', target: 'D007', label: '1G', animated: false },
  { id: 'e3-8', source: 'D003', target: 'D008', label: '1G', animated: false },
  { id: 'e4-9', source: 'D004', target: 'D009', label: '1G', animated: false },
  { id: 'e4-10', source: 'D004', target: 'D010', label: '1G', animated: false, style: { stroke: '#ef4444', strokeDasharray: '5,5' } },
  { id: 'e11-15', source: 'D011', target: 'D015', label: '10G', animated: false },
];

const logMessages = [
  { level: 'info' as const, source: 'core-rtr-01', sourceIp: '10.0.0.1', facility: 'LOCAL7', message: 'Interface GigabitEthernet0/0/0 changed state to up' },
  { level: 'warning' as const, source: 'dist-sw-02', sourceIp: '10.0.1.2', facility: 'LOCAL6', message: 'CPU utilization high: 78%' },
  { level: 'critical' as const, source: 'db-srv-02', sourceIp: '10.1.1.11', facility: 'KERNEL', message: 'Network interface eth0 link down' },
  { level: 'info' as const, source: 'fw-primary', sourceIp: '10.0.2.1', facility: 'LOCAL5', message: 'Security policy updated by admin' },
  { level: 'error' as const, source: 'lb-01', sourceIp: '10.0.3.1', facility: 'LOCAL4', message: 'Backend pool member 10.1.0.10 marked down' },
  { level: 'info' as const, source: 'brc-rtr-01', sourceIp: '10.10.0.1', facility: 'BGP', message: 'BGP peer 10.10.0.254 flapped' },
  { level: 'warning' as const, source: 'storage-01', sourceIp: '10.1.2.10', facility: 'DISK', message: 'Volume /vol/prod_db at 91% capacity' },
  { level: 'info' as const, source: 'vpn-gw-01', sourceIp: '10.0.4.1', facility: 'VPN', message: 'IPSec tunnel to SITE-PAR established' },
  { level: 'debug' as const, source: 'mon-srv-01', sourceIp: '10.1.3.10', facility: 'SYSLOG', message: 'Polling cycle completed: 20 devices in 2.3s' },
  { level: 'error' as const, source: 'lon-rtr-01', sourceIp: '10.20.0.1', facility: 'OSPF', message: 'OSPF neighbor 10.20.0.254 down' },
];

// ─── Main Seed Function ────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seeding NMS database...\n');

  try {
    // ─── SAFETY GUARD ─────────────────────────────────────────────────────────
    // Abort if real data already exists, to prevent accidental data loss.
    // To force re-seed anyway, set env var: FORCE_SEED=true
    const existingDevices = await db.select().from(devices).limit(1);
    if (existingDevices.length > 0 && process.env.FORCE_SEED !== 'true') {
      console.error('❌ ABORTED: The database already contains devices.');
      console.error('   Running db:seed would DELETE all your real data.');
      console.error('   If you really want to reset to demo data, run:');
      console.error('   FORCE_SEED=true npm run db:seed');
      process.exit(1);
    }

    // Clear existing data (only reached if DB is empty or FORCE_SEED=true)
    console.log('  Clearing existing data...');
    await db.delete(topologyEdges);
    await db.delete(topologyNodes);
    await db.delete(logs);
    await db.delete(metrics);
    await db.delete(alerts);
    await db.delete(jobs);
    await db.delete(devices);
    await db.delete(users);


    // Seed devices
    console.log('  Seeding devices...');
    for (const d of devicesSeed) {
      await db.insert(devices).values({
        ...d,
        tags: d.tags,
        lastSeen: new Date(),
      });
    }
    console.log(`  ✓ ${devicesSeed.length} devices`);

    // Seed alerts
    console.log('  Seeding alerts...');
    for (const a of alertsSeed) {
      await db.insert(alerts).values({ ...a, createdAt: new Date() });
    }
    console.log(`  ✓ ${alertsSeed.length} alerts`);

    // Seed jobs
    console.log('  Seeding jobs...');
    const now = new Date();
    for (const j of jobsSeed) {
      await db.insert(jobs).values({
        ...j,
        lastRun: now,
        nextRun: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      });
    }
    console.log(`  ✓ ${jobsSeed.length} jobs`);

    // Seed users (hash passwords)
    console.log('  Seeding users...');
    for (const u of usersSeed) {
      const hashed = await bcrypt.hash(u.password, 10);
      await db.insert(users).values({ ...u, password: hashed });
    }
    console.log(`  ✓ ${usersSeed.length} users`);

    // Seed topology
    console.log('  Seeding topology...');
    for (const n of topologyNodesSeed) await db.insert(topologyNodes).values(n);
    for (const e of topologyEdgesSeed) await db.insert(topologyEdges).values(e);
    console.log(`  ✓ ${topologyNodesSeed.length} nodes, ${topologyEdgesSeed.length} edges`);

    // Seed logs
    console.log('  Seeding logs...');
    for (const l of logMessages) await db.insert(logs).values({ ...l, raw: JSON.stringify(l) });
    console.log(`  ✓ ${logMessages.length} log entries`);

    // Seed initial metrics for each device
    console.log('  Seeding metrics...');
    const metricInserts = devicesSeed.map(d => ({
      deviceId: d.id,
      cpu: d.cpu,
      memory: d.memory,
      disk: d.disk,
      inbound: Math.random() * 800 + 100,
      outbound: Math.random() * 600 + 80,
    }));
    for (const m of metricInserts) await db.insert(metrics).values(m);
    console.log(`  ✓ ${metricInserts.length} metric records`);

    console.log('\n✅ Database seeded successfully!');
    console.log('\n📋 Login credentials:');
    console.log('   admin@tecsidel.com / admin123');
    console.log('   j.garcia@tecsidel.com / pass1234');
  } catch (err) {
    console.error('\n❌ Seed error:', err);
    process.exit(1);
  }
  process.exit(0);
}

main();
