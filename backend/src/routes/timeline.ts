import { Router } from 'express';
import { db } from '../db/connection.js';
import { deviceTimeline, devices } from '../db/schema.js';
import { eq, and, gte, desc, isNull, or } from 'drizzle-orm';
import {
  dedupeOpenTimelineSegments,
  dedupeClosedTimelineSegments,
  repairOverlappingTimelineSegments,
  normalizeTimelineSegments,
  leadingGapMs,
} from '../lib/timelineSegments.js';

const router = Router();

// GET /api/devices/:id/timeline?range=24h
router.get('/:id/timeline', async (req, res) => {
  try {
    const { id } = req.params;
    const range = (req.query.range as string) || '24h';

    const now = new Date();
    const rangeMap: Record<string, number> = {
      '4h':   4 * 60 * 60 * 1000,
      '24h':  24 * 60 * 60 * 1000,
      '7d':   7 * 24 * 60 * 60 * 1000,
      '30d':  30 * 24 * 60 * 60 * 1000,
      '365d': 365 * 24 * 60 * 60 * 1000,
    };
    const windowMs = rangeMap[range] ?? rangeMap['24h'];
    const windowStart = new Date(now.getTime() - windowMs);
    const windowStartMs = windowStart.getTime();
    const nowMs = now.getTime();

    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    // Clean up duplicate / overlapping segments (does NOT invent new state changes).
    await dedupeOpenTimelineSegments(id);
    await dedupeClosedTimelineSegments(id);
    await repairOverlappingTimelineSegments(id);

    // Pure read — no status sync so manual DB edits are preserved.
    const [deviceMeta] = await db.select().from(devices).where(eq(devices.id, id));

    const rows = await db
      .select()
      .from(deviceTimeline)
      .where(
        and(
          eq(deviceTimeline.deviceId, id),
          or(
            gte(deviceTimeline.startedAt, windowStart),
            gte(deviceTimeline.endedAt, windowStart),
            isNull(deviceTimeline.endedAt)
          )
        )
      )
      .orderBy(desc(deviceTimeline.startedAt));

    const rawSegments = rows.map((row) => {
      const rawStart = new Date(row.startedAt).getTime();
      const rawEnd = row.endedAt ? new Date(row.endedAt).getTime() : nowMs;
      const segStart = Math.max(rawStart, windowStartMs);
      const segEnd = Math.min(rawEnd, nowMs);
      const durationMs = Math.max(segEnd - segStart, 0);

      return {
        id: row.id,
        state: row.state as 'online' | 'offline',
        startedAt: row.startedAt instanceof Date ? row.startedAt.toISOString() : String(row.startedAt),
        endedAt: row.endedAt
          ? (row.endedAt instanceof Date ? row.endedAt.toISOString() : String(row.endedAt))
          : null,
        durationSecs: Math.floor(durationMs / 1000),
        durationPct: ((durationMs / windowMs) * 100).toFixed(2),
        summary: row.summary ?? null,
        isCurrent: !row.endedAt,
      };
    });

    const segments = normalizeTimelineSegments(rawSegments, windowStartMs, nowMs, windowMs);
    const gap = leadingGapMs(segments, windowStartMs);

    const totalOnlineSecs = segments
      .filter(s => s.state === 'online')
      .reduce((sum, s) => sum + s.durationSecs, 0);
    const totalSecs = Math.floor(windowMs / 1000);
    const uptimePct = ((totalOnlineSecs / totalSecs) * 100).toFixed(2);

    res.json({
      device: {
        id: deviceMeta!.id,
        hostname: deviceMeta!.hostname,
        ip: deviceMeta!.ip,
        status: deviceMeta!.status,
      },
      range,
      windowStart: windowStart.toISOString(),
      windowEnd: now.toISOString(),
      segments,
      leadingGap: gap
        ? {
            from: new Date(gap.fromMs).toISOString(),
            to: new Date(gap.toMs).toISOString(),
            durationSecs: Math.floor((gap.toMs - gap.fromMs) / 1000),
            durationPct: (((gap.toMs - gap.fromMs) / windowMs) * 100).toFixed(2),
          }
        : null,
      totalOnlineSecs,
      totalSecs,
      uptimePct,
    });
  } catch (err) {
    console.error('[Timeline] Error:', err);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

export default router;
