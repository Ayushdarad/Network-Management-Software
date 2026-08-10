/**
 * scheduler.ts — Job runner for ICMP monitoring, log cleanup, and uptime reports.
 */

import { db } from './db/connection.js';
import { jobs, devices, logs } from './db/schema.js';
import { eq, lt, like, desc } from 'drizzle-orm';
import { pollDevicesFiltered } from './pingMonitor.js';
import { getSetting } from './routes/settings.js';
import { broadcastJobProgress, broadcastJobUpdate } from './websocket.js';

interface ScheduledJob {
  id: string;
  name: string;
  type: string;
  targetDevice: string | null;
  cron: string | null;
  frequency: string;
  intervalMs: number;
  timerId: ReturnType<typeof setInterval> | null;
  nextRun: Date;
}

const activeTimers = new Map<string, ReturnType<typeof setInterval>>();

function frequencyToMs(frequency: string, cron: string | null): number {
  if (cron) {
    const parts = cron.trim().split(/\s+/);
    if (parts.length === 5) {
      const [minute, hour] = parts;
      const everyMin = minute.match(/^\*\/(\d+)$/);
      if (everyMin) return Number(everyMin[1]) * 60 * 1_000;
      const everyHour = hour.match(/^\*\/(\d+)$/);
      if (everyHour) return Number(everyHour[1]) * 3_600 * 1_000;
      if (minute !== '*' && hour !== '*') return 24 * 3_600 * 1_000;
    }
  }

  switch (frequency.toLowerCase()) {
    case 'every minute':    return 60 * 1_000;
    case 'every 5 minutes': return 5 * 60 * 1_000;
    case 'every 15 minutes':return 15 * 60 * 1_000;
    case 'every 30 minutes':return 30 * 60 * 1_000;
    case 'hourly':          return 3_600 * 1_000;
    case 'every 6 hours':   return 6 * 3_600 * 1_000;
    case 'every 12 hours':  return 12 * 3_600 * 1_000;
    case 'daily':           return 24 * 3_600 * 1_000;
    case 'weekly':          return 7 * 24 * 3_600 * 1_000;
    case 'monthly':         return 30 * 24 * 3_600 * 1_000;
    default:                return 24 * 3_600 * 1_000;
  }
}

function formatDuration(ms: number): string {
  const secs = Math.floor(ms / 1_000);
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function targetLabel(target: string | null): string {
  if (!target) return 'all devices';
  if (target.startsWith('site:')) return `site ${target.slice(5)}`;
  return target;
}

async function logJobRun(
  job: ScheduledJob,
  success: boolean,
  message: string,
  durationMs: number,
  detail?: Record<string, unknown>,
) {
  await db.insert(logs).values({
    level: success ? 'info' : 'error',
    source: 'Scheduler',
    sourceIp: '127.0.0.1',
    facility: 'LOCAL1',
    message,
    raw: JSON.stringify({
      jobId: job.id,
      jobName: job.name,
      type: job.type,
      success,
      durationMs,
      target: job.targetDevice,
      ...detail,
    }),
  }).catch(() => {});
}

async function runPingCheckJob(job: ScheduledJob): Promise<string> {
  const result = await pollDevicesFiltered(job.targetDevice);
  if (result.polled === 0) {
    throw new Error(`No devices matched target "${targetLabel(job.targetDevice)}"`);
  }
  return `Ping check complete — ${result.online} online, ${result.offline} offline (${result.polled} polled)`;
}

async function runLogCleanupJob(job: ScheduledJob): Promise<string> {
  const retentionDays = getSetting<number>('logRetention', 180);
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  const oldRows = await db.select({ id: logs.id }).from(logs).where(lt(logs.createdAt, cutoff));
  if (oldRows.length === 0) {
    return `Log cleanup — no entries older than ${retentionDays} days`;
  }
  await db.delete(logs).where(lt(logs.createdAt, cutoff));
  return `Log cleanup — removed ${oldRows.length} entries older than ${retentionDays} days`;
}

async function runUptimeReportJob(job: ScheduledJob): Promise<string> {
  const allDevices = await db.select().from(devices);
  const online = allDevices.filter(d => d.status === 'online').length;
  const offline = allDevices.filter(d => d.status === 'offline').length;
  const warning = allDevices.filter(d => d.status === 'warning').length;

  const withPolls = allDevices.filter(d => (d.totalPolls ?? 0) > 0);
  const avgUptime = withPolls.length > 0
    ? (withPolls.reduce((s, d) => s + ((d.onlinePolls ?? 0) / (d.totalPolls ?? 1)) * 100, 0) / withPolls.length).toFixed(1)
    : 'N/A';

  return `Uptime report — ${allDevices.length} devices: ${online} online, ${offline} offline, ${warning} warning. Avg uptime: ${avgUptime}%`;
}

async function executeJobType(job: ScheduledJob): Promise<string> {
  const type = job.type.toLowerCase();
  if (type.includes('ping')) return runPingCheckJob(job);
  if (type.includes('log') && type.includes('clean')) return runLogCleanupJob(job);
  if (type.includes('uptime') || (type.includes('report') && !type.includes('performance'))) {
    return runUptimeReportJob(job);
  }
  // Legacy seeded job types — map to nearest real behavior
  if (type.includes('backup') || type.includes('compliance') || type.includes('scan')) {
    return runLogCleanupJob(job);
  }
  if (type.includes('performance')) return runUptimeReportJob(job);
  throw new Error(`Unsupported job type: ${job.type}`);
}

async function executeJob(job: ScheduledJob): Promise<void> {
  const start = Date.now();
  console.log(`[Scheduler] ▶ Starting job: ${job.name} (${job.id})`);

  await db.update(jobs)
    .set({ status: 'running', progress: 0, lastRun: new Date() })
    .where(eq(jobs.id, job.id))
    .catch(() => {});
  broadcastJobUpdate(job.id, { status: 'running', progress: 0 });

  let success = true;
  let resultMessage = '';

  try {
    await db.update(jobs).set({ progress: 30 }).where(eq(jobs.id, job.id)).catch(() => {});
    broadcastJobProgress(job.id, 30);

    resultMessage = await executeJobType(job);

    await db.update(jobs).set({ progress: 90 }).where(eq(jobs.id, job.id)).catch(() => {});
    broadcastJobProgress(job.id, 90);
  } catch (err: any) {
    console.error(`[Scheduler] ✗ Job "${job.name}" failed:`, err);
    success = false;
    resultMessage = err?.message || 'Job failed';
  }

  const durationMs = Date.now() - start;
  const nextRun = new Date(Date.now() + job.intervalMs);
  const duration = formatDuration(durationMs);
  const status = success ? 'success' : 'failed';

  await db.update(jobs)
    .set({ status, progress: success ? 100 : 0, duration, nextRun })
    .where(eq(jobs.id, job.id))
    .catch(() => {});

  await logJobRun(job, success, `[${job.name}] ${resultMessage}`, durationMs);

  broadcastJobUpdate(job.id, { status, progress: success ? 100 : 0, duration, nextRun: nextRun.toISOString() });
  broadcastJobProgress(job.id, success ? 100 : 0);

  console.log(
    `[Scheduler] ${success ? '✔' : '✗'} Job "${job.name}" finished in ${duration}. Next: ${nextRun.toISOString()}`
  );
}

async function buildScheduledJob(row: typeof jobs.$inferSelect): Promise<ScheduledJob> {
  let intervalMs = frequencyToMs(row.frequency, row.cron ?? null);

  // Only the dedicated background monitor job (JOB-003) follows Settings → poll interval.
  // All other Device Ping Check jobs use their own configured frequency/cron.
  if (row.id === 'JOB-003' && row.type === 'Device Ping Check' && !row.targetDevice) {
    intervalMs = getSetting<number>('pollInterval', 30) * 1000;
  }

  return {
    id: row.id,
    name: row.name,
    type: row.type,
    targetDevice: row.targetDevice ?? null,
    cron: row.cron ?? null,
    frequency: row.frequency,
    intervalMs,
    timerId: null,
    nextRun: new Date(Date.now() + intervalMs),
  };
}

async function scheduleJob(job: ScheduledJob): Promise<void> {
  const existing = activeTimers.get(job.id);
  if (existing) clearInterval(existing);

  const firstNextRun = new Date(Date.now() + job.intervalMs);
  await db.update(jobs)
    .set({ nextRun: firstNextRun, status: 'scheduled' })
    .where(eq(jobs.id, job.id))
    .catch(() => {});

  console.log(
    `[Scheduler] Registered "${job.name}" (${job.id}) — every ${formatDuration(job.intervalMs)}, target: ${targetLabel(job.targetDevice)}`
  );

  const timer = setInterval(() => executeJob(job), job.intervalMs);
  activeTimers.set(job.id, timer);
}

export async function startScheduler(): Promise<void> {
  console.log('[Scheduler] Initializing…');
  try {
    const enabledJobs = await db.select().from(jobs).where(eq(jobs.enabled, true));
    if (enabledJobs.length === 0) {
      console.log('[Scheduler] No enabled jobs found.');
      return;
    }
    for (const row of enabledJobs) {
      await scheduleJob(await buildScheduledJob(row));
    }
    console.log(`[Scheduler] ✔ ${enabledJobs.length} job(s) scheduled.`);
  } catch (err) {
    console.error('[Scheduler] Failed to initialize:', err);
  }
}

export async function reloadScheduler(): Promise<void> {
  console.log('[Scheduler] Reloading…');
  for (const timer of activeTimers.values()) clearInterval(timer);
  activeTimers.clear();
  await startScheduler();
}

export async function runJobNow(jobId: string): Promise<void> {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!row) throw new Error('Job not found');
  await executeJob(await buildScheduledJob(row));
}

export async function pauseJob(jobId: string): Promise<void> {
  const timer = activeTimers.get(jobId);
  if (timer) clearInterval(timer);
  activeTimers.delete(jobId);
  await db.update(jobs).set({ enabled: false, status: 'paused' }).where(eq(jobs.id, jobId)).catch(() => {});
  broadcastJobUpdate(jobId, { status: 'paused', enabled: false });
}

export async function resumeJob(jobId: string): Promise<void> {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!row) throw new Error('Job not found');
  await db.update(jobs).set({ enabled: true, status: 'scheduled' }).where(eq(jobs.id, jobId)).catch(() => {});
  await reloadScheduler();
  broadcastJobUpdate(jobId, { status: 'scheduled', enabled: true });
}

/** Fetch recent execution log entries for a job. */
export async function getJobHistory(jobId: string, limit = 30) {
  const rows = await db.select().from(logs)
    .where(like(logs.raw, `%\"jobId\":\"${jobId}\"%`))
    .orderBy(desc(logs.createdAt))
    .limit(limit);
  return rows;
}

export function isGlobalPingJob(type: string, targetDevice: string | null | undefined): boolean {
  return type === 'Device Ping Check' && !targetDevice;
}

startScheduler();
