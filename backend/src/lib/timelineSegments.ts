import { db } from '../db/connection.js';
import { deviceTimeline } from '../db/schema.js';
import { eq, and, isNull, desc, sql } from 'drizzle-orm';

export type TimelineSegmentRow = {
  id: number;
  state: 'online' | 'offline';
  startedAt: string;
  endedAt: string | null;
  durationSecs: number;
  durationPct: string;
  summary: string | null;
  isCurrent: boolean;
};

type Interval = {
  id: number;
  state: 'online' | 'offline';
  startMs: number;
  endMs: number; // exclusive-ish; use Infinity for open
  summary: string | null;
  isCurrent: boolean;
  originalEndedAt: string | null;
};

function toMs(value: string | Date | null | undefined): number | null {
  if (value == null) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Collapse overlapping / adjacent intervals into a single non-overlapping timeline. */
function resolveIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => {
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    return a.id - b.id; // later write wins on identical start
  });

  const out: Interval[] = [];

  for (const seg of sorted) {
    while (out.length > 0) {
      const prev = out[out.length - 1];

      // No overlap — optionally merge adjacent same-state
      if (seg.startMs >= prev.endMs) {
        if (prev.state === seg.state && seg.startMs <= prev.endMs + 2000) {
          prev.endMs = Math.max(prev.endMs, seg.endMs);
          prev.isCurrent = seg.isCurrent || (prev.endMs === Infinity);
          if (seg.summary) prev.summary = seg.summary;
          // absorbed into prev
          seg.startMs = seg.endMs; // mark absorbed
        }
        break;
      }

      // Overlap
      if (prev.state === seg.state) {
        prev.endMs = Math.max(prev.endMs, seg.endMs);
        prev.isCurrent = seg.isCurrent || prev.endMs === Infinity;
        if (seg.summary) prev.summary = seg.summary;
        seg.startMs = seg.endMs; // absorbed
        break;
      }

      // Different state overlapping: later-starting segment wins.
      // If they share the same start, drop the earlier (lower id) prev.
      if (seg.startMs <= prev.startMs) {
        out.pop();
        continue;
      }

      // Truncate previous segment so it ends when the new state begins.
      prev.endMs = seg.startMs;
      prev.isCurrent = false;
      if (prev.endMs <= prev.startMs) {
        out.pop();
        continue;
      }
      break;
    }

    if (seg.startMs < seg.endMs) {
      out.push({ ...seg });
    }
  }

  return out;
}

/** Keep only the newest open segment; close any extras at its start time. */
export async function dedupeOpenTimelineSegments(deviceId: string) {
  const open = await db
    .select()
    .from(deviceTimeline)
    .where(and(eq(deviceTimeline.deviceId, deviceId), isNull(deviceTimeline.endedAt)))
    .orderBy(desc(deviceTimeline.startedAt), desc(deviceTimeline.id));

  if (open.length <= 1) return;

  const [keep, ...stale] = open;
  const keepStart = new Date(keep.startedAt).getTime();

  for (const row of stale) {
    const startMs = new Date(row.startedAt).getTime();
    const endAt = new Date(keepStart);
    const durationSecs = Math.max(0, Math.floor((endAt.getTime() - startMs) / 1000));
    await db.update(deviceTimeline)
      .set({ endedAt: endAt, durationSecs })
      .where(eq(deviceTimeline.id, row.id));
  }
}

/**
 * Remove duplicate closed segments that share the same startedAt (to the second).
 * Keeps the row with the highest id (most recently written); deletes the rest.
 */
export async function dedupeClosedTimelineSegments(deviceId: string) {
  const rows = await db
    .select()
    .from(deviceTimeline)
    .where(and(eq(deviceTimeline.deviceId, deviceId), sql`${deviceTimeline.endedAt} IS NOT NULL`))
    .orderBy(desc(deviceTimeline.id));

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.state}|${new Date(row.startedAt).toISOString().slice(0, 19)}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const [, ...toDelete] = group;
    for (const row of toDelete) {
      await db.delete(deviceTimeline).where(eq(deviceTimeline.id, row.id));
    }
  }
}

/**
 * Repair overlapping UP/DOWN history in the DB so intervals never contradict.
 * Truncates earlier segments when a later state begins; deletes zero-length leftovers.
 */
export async function repairOverlappingTimelineSegments(deviceId: string) {
  const rows = await db
    .select()
    .from(deviceTimeline)
    .where(eq(deviceTimeline.deviceId, deviceId))
    .orderBy(deviceTimeline.startedAt, deviceTimeline.id);

  if (rows.length <= 1) return;

  const nowMs = Date.now();
  const intervals: Interval[] = rows.map((row) => {
    const startMs = toMs(row.startedAt) ?? nowMs;
    const endMs = row.endedAt ? (toMs(row.endedAt) ?? startMs) : Infinity;
    return {
      id: row.id,
      state: row.state as 'online' | 'offline',
      startMs,
      endMs: endMs < startMs ? startMs : endMs,
      summary: row.summary ?? null,
      isCurrent: !row.endedAt,
      originalEndedAt: row.endedAt
        ? (row.endedAt instanceof Date ? row.endedAt.toISOString() : String(row.endedAt))
        : null,
    };
  });

  const resolved = resolveIntervals(intervals);
  const keepIds = new Set(resolved.map((r) => r.id));

  for (const row of rows) {
    if (!keepIds.has(row.id)) {
      await db.delete(deviceTimeline).where(eq(deviceTimeline.id, row.id));
    }
  }

  for (const seg of resolved) {
    const original = rows.find((r) => r.id === seg.id);
    if (!original) continue;

    const endedAt = seg.endMs === Infinity ? null : new Date(seg.endMs);
    const durationSecs = seg.endMs === Infinity
      ? null
      : Math.max(0, Math.floor((seg.endMs - seg.startMs) / 1000));

    const origEndMs = original.endedAt ? toMs(original.endedAt) : Infinity;
    const needsUpdate =
      origEndMs !== seg.endMs ||
      (original.durationSecs ?? null) !== durationSecs;

    if (needsUpdate) {
      await db.update(deviceTimeline)
        .set({ endedAt, durationSecs })
        .where(eq(deviceTimeline.id, seg.id));
    }
  }
}

/** Merge overlaps, drop zero-length rows, combine adjacent same-state segments. */
export function normalizeTimelineSegments(
  rows: TimelineSegmentRow[],
  windowStartMs: number,
  windowEndMs: number,
  windowMs: number,
): TimelineSegmentRow[] {
  if (rows.length === 0) return [];

  const intervals: Interval[] = [];
  for (const row of rows) {
    const rawStart = toMs(row.startedAt);
    if (rawStart == null) continue;
    const rawEnd = row.endedAt ? (toMs(row.endedAt) ?? windowEndMs) : windowEndMs;
    const segStart = Math.max(rawStart, windowStartMs);
    const segEnd = Math.min(rawEnd, windowEndMs);
    if (segEnd <= segStart) continue;

    intervals.push({
      id: row.id,
      state: row.state,
      startMs: segStart,
      endMs: segEnd,
      summary: row.summary,
      isCurrent: row.isCurrent && !row.endedAt,
      originalEndedAt: row.endedAt,
    });
  }

  const resolved = resolveIntervals(intervals);

  return resolved.map((seg) => {
    const durationMs = seg.endMs - seg.startMs;
    const isCurrent = seg.isCurrent && seg.endMs >= windowEndMs - 1000;
    return {
      id: seg.id,
      state: seg.state,
      startedAt: new Date(seg.startMs).toISOString(),
      endedAt: isCurrent ? null : new Date(seg.endMs).toISOString(),
      durationSecs: Math.floor(durationMs / 1000),
      durationPct: ((durationMs / windowMs) * 100).toFixed(2),
      summary: seg.summary,
      isCurrent,
    };
  });
}

/** Leading gap before first monitored segment (if any). */
export function leadingGapMs(
  segments: TimelineSegmentRow[],
  windowStartMs: number,
): { fromMs: number; toMs: number } | null {
  if (segments.length === 0) return null;
  const firstStart = new Date(segments[0].startedAt).getTime();
  if (firstStart > windowStartMs + 1000) {
    return { fromMs: windowStartMs, toMs: firstStart };
  }
  return null;
}
