import { db } from './db/connection.js';
import { devices, alerts, logs, deviceTimeline } from './db/schema.js';
import { eq, sql, isNull, and, ne, desc } from 'drizzle-orm';
import { broadcastAlertEvent, sendAlertCount } from './websocket.js';
import { pingHost } from './lib/ping.js';

/** Serialize timeline writes per device (prevents dual open UP/DOWN chains). */
const devicePollLocks = new Map<string, Promise<unknown>>();

async function withDeviceLock<T>(deviceId: string, fn: () => Promise<T>): Promise<T> {
  const prev = devicePollLocks.get(deviceId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const chained = prev.then(() => gate, () => gate);
  devicePollLocks.set(deviceId, chained);
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
    if (devicePollLocks.get(deviceId) === chained) devicePollLocks.delete(deviceId);
  }
}

/** Format seconds into a human-readable duration string */
function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * Poll a single device, update status + uptime counters based on real ping results.
 */
export async function pollDevice(dev: any) {
  return withDeviceLock(dev.id, () => pollDeviceLocked(dev));
}

async function pollDeviceLocked(dev: any) {
  // Re-read status under the lock so concurrent polls don't use a stale previousStatus.
  const [fresh] = await db.select().from(devices).where(eq(devices.id, dev.id)).limit(1);
  if (!fresh) return { hostname: dev.hostname, ip: dev.ip, status: 'unknown', reachable: false };
  dev = fresh;

  const isReachable = await pingHost(dev.ip);
  const previousStatus = dev.status;

  let newStatus: 'online' | 'offline' | 'warning' | 'unknown';
  if (isReachable) {
    newStatus = previousStatus === 'warning' ? 'warning' : 'online';
  } else {
    newStatus = 'offline';
  }

  // Calculate current uptime based on the open timeline segment
  const openSegment = await db
    .select()
    .from(deviceTimeline)
    .where(and(eq(deviceTimeline.deviceId, dev.id), isNull(deviceTimeline.endedAt)))
    .limit(1);

  let currentUptime = '0d 0h';
  if (openSegment.length > 0 && newStatus === 'online') {
    const secs = Math.floor((Date.now() - new Date(openSegment[0].startedAt).getTime()) / 1000);
    currentUptime = formatDuration(secs);
  }

  // Always increment poll counters regardless of status change
  const updateFields: Record<string, any> = {
    status: newStatus,
    uptime: currentUptime,
    totalPolls: sql`total_polls + 1`,
    onlinePolls: isReachable
      ? sql`online_polls + 1`
      : sql`online_polls`,  // no increment if offline
  };

  if (isReachable) updateFields.lastSeen = new Date();

  await db.update(devices)
    .set(updateFields)
    .where(eq(devices.id, dev.id));

  // ── Status transition: handle timeline + alerts ────────────────────────
  const timelineState = (newStatus === 'online') ? 'online' : 'offline';
  const prevTimelineState = (previousStatus === 'online') ? 'online' : 'offline';

  if (timelineState !== prevTimelineState) {
    console.log(`[Ping Monitor] ${dev.hostname} (${dev.ip}): ${previousStatus} → ${newStatus}`);

    const now = new Date();

    // Close ALL open segments (never leave a parallel UP/DOWN chain).
    const openSegments = await db
      .select()
      .from(deviceTimeline)
      .where(and(eq(deviceTimeline.deviceId, dev.id), isNull(deviceTimeline.endedAt)));

    for (const seg of openSegments) {
      const durationSecs = Math.max(0, Math.floor((now.getTime() - new Date(seg.startedAt).getTime()) / 1000));
      await db.update(deviceTimeline)
        .set({ endedAt: now, durationSecs })
        .where(eq(deviceTimeline.id, seg.id));
    }

    const segmentSummary = timelineState === 'online'
      ? `OK - ${dev.ip}: host back online, ping restored.`
      : `CRITICAL - ${dev.ip}: rta nan, lost 100%`;
    await db.insert(deviceTimeline).values({
      deviceId: dev.id,
      hostname: dev.hostname,
      state: timelineState,
      startedAt: now,
      summary: segmentSummary,
    }).catch(() => {});


    // ── DEVICE WENT OFFLINE ──────────────────────────────────────────────
    if (newStatus === 'offline' && previousStatus !== 'offline') {
      const [existingAlert] = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.deviceIp, dev.ip),
            ne(alerts.status, 'resolved')   // active OR acknowledged
          )
        )
        .limit(1);

      if (!existingAlert) {
        // Fresh outage — create ONE new alert.
        const alertId = `ALT-${dev.id.slice(-3).toUpperCase()}${String(Date.now()).slice(-7)}`;
        const alertTime = new Date();
        await db.insert(alerts).values({
          id:          alertId,
          severity:    'critical',
          status:      'active',
          title:       'Host Unreachable',
          description: `Device ${dev.hostname} (${dev.ip}) is not responding to ICMP ping.`,
          device:      dev.hostname,
          deviceIp:    dev.ip,
          site:        dev.site ?? '',
          category:    'Availability',
          duration:    '0m',
          count:       1,
          createdAt:   alertTime,
          updatedAt:   alertTime,
        }).catch(() => {});

        // Broadcast new alert in real-time
        await broadcastAlertEvent('alert:new', alertId).catch(() => {});
      }

      // Log the outage event (explicit createdAt for correct UTC timestamp)
      await db.insert(logs).values({
        level:     'error',
        source:    dev.hostname,
        sourceIp:  dev.ip,
        facility:  'LOCAL0',
        message:   `Host ${dev.hostname} (${dev.ip}) is UNREACHABLE — no ping response.`,
        raw:       JSON.stringify({ event: 'host_down', host: dev.hostname, ip: dev.ip }),
        createdAt: now,
      }).catch(() => {});
    }

    // ── DEVICE CAME BACK ONLINE ──────────────────────────────────────────
    if (newStatus === 'online' && previousStatus === 'offline') {
      const [activeAlert] = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.deviceIp, dev.ip),
            ne(alerts.status, 'resolved')
          )
        )
        .limit(1);

      if (activeAlert) {
        const downtimeSecs = Math.floor(
          (now.getTime() - new Date(activeAlert.createdAt).getTime()) / 1000
        );
        await db.update(alerts)
          .set({
            status:    'resolved',
            duration:  formatDuration(downtimeSecs),
            updatedAt: now,
          })
          .where(eq(alerts.id, activeAlert.id))
          .catch(() => {});
      }

      // Push updated alert counts to all clients
      await sendAlertCount().catch(() => {});

      // Log the recovery event (explicit createdAt for correct UTC timestamp)
      await db.insert(logs).values({
        level:     'info',
        source:    dev.hostname,
        sourceIp:  dev.ip,
        facility:  'LOCAL0',
        message:   `Host ${dev.hostname} (${dev.ip}) is back ONLINE — ping restored.`,
        raw:       JSON.stringify({ event: 'host_up', host: dev.hostname, ip: dev.ip }),
        createdAt: now,
      }).catch(() => {});
    }

  } else {
    // ── No timeline-state change: ensure exactly one matching open segment ──
    const openSegments = await db
      .select()
      .from(deviceTimeline)
      .where(and(eq(deviceTimeline.deviceId, dev.id), isNull(deviceTimeline.endedAt)))
      .orderBy(desc(deviceTimeline.id));

    const now = new Date();
    const matching = openSegments.filter((s) => s.state === timelineState);
    const mismatched = openSegments.filter((s) => s.state !== timelineState);

    // Close any open segment whose state disagrees with the device.
    for (const seg of mismatched) {
      const durationSecs = Math.max(0, Math.floor((now.getTime() - new Date(seg.startedAt).getTime()) / 1000));
      await db.update(deviceTimeline)
        .set({ endedAt: now, durationSecs })
        .where(eq(deviceTimeline.id, seg.id));
    }

    // Keep newest matching open segment; close older duplicates.
    if (matching.length > 1) {
      const [, ...stale] = matching;
      for (const seg of stale) {
        const durationSecs = Math.max(0, Math.floor((now.getTime() - new Date(seg.startedAt).getTime()) / 1000));
        await db.update(deviceTimeline)
          .set({ endedAt: now, durationSecs })
          .where(eq(deviceTimeline.id, seg.id));
      }
    }

    if (matching.length === 0) {
      const summary = timelineState === 'online'
        ? `OK - ${dev.ip}: host online, ping responding.`
        : `CRITICAL - ${dev.ip}: rta nan, lost 100%`;
      await db.insert(deviceTimeline).values({
        deviceId: dev.id,
        hostname: dev.hostname,
        state:    timelineState,
        summary,
        startedAt: now,
      }).catch(() => {});
    }

    if (newStatus !== previousStatus) {
      console.log(`[Ping Monitor] ${dev.hostname} (${dev.ip}): ${previousStatus} → ${newStatus} (timeline unchanged)`);
    }
  }

  return { hostname: dev.hostname, ip: dev.ip, status: newStatus, reachable: isReachable };
}

/**
 * Poll devices matching an optional target scope.
 * targetDevice: empty = all | hostname = one device | site:SITE-ID = site filter
 */
export async function pollDevicesFiltered(targetDevice: string | null | undefined) {
  try {
    let deviceList;
    const target = targetDevice?.trim() ?? '';

    if (!target) {
      deviceList = await db.select().from(devices);
    } else if (target.startsWith('site:')) {
      const site = target.slice(5);
      deviceList = await db.select().from(devices).where(eq(devices.site, site));
    } else {
      deviceList = await db.select().from(devices).where(eq(devices.hostname, target));
    }

    if (deviceList.length === 0) {
      console.log(`[Ping Monitor] No devices matched target "${target || 'all'}"`);
      return { polled: 0, online: 0, offline: 0 };
    }

    console.log(`[Ping Monitor] Polling ${deviceList.length} device(s) [target: ${target || 'all'}]…`);

    const results = await Promise.allSettled(deviceList.map(dev => pollDevice(dev)));
    const summary = results.map(r => r.status === 'fulfilled' ? r.value : { reachable: false });
    const online = summary.filter((s: any) => s.reachable === true).length;
    const offline = summary.filter((s: any) => s.reachable === false).length;
    console.log(`[Ping Monitor] Done — ${online} online, ${offline} unreachable.`);
    return { polled: deviceList.length, online, offline };
  } catch (err) {
    console.error('[Ping Monitor] Fatal error:', err);
    throw err;
  }
}

/**
 * Poll all devices, update status + uptime counters based on real ping results.
 */
export async function pollAllDevices() {
  await pollDevicesFiltered(null);
}


