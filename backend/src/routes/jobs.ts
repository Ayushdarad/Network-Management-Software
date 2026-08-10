import { Router } from 'express';
import { db } from '../db/connection.js';
import { jobs } from '../db/schema.js';
import { desc, eq, and } from 'drizzle-orm';
import type { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { jobCreateSchema, parseBody } from '../lib/validation.js';
import {
  runJobNow, pauseJob, resumeJob, reloadScheduler,
  getJobHistory, isGlobalPingJob,
} from '../scheduler.js';

const router = Router();

async function assertSingleGlobalPing(
  type: string,
  targetDevice: string | undefined | null,
  enabled: boolean,
  excludeId?: string,
) {
  if (!enabled || !isGlobalPingJob(type, targetDevice ?? null)) return;
  const rows = await db.select().from(jobs).where(
    and(eq(jobs.type, 'Device Ping Check'), eq(jobs.enabled, true))
  );
  const conflict = rows.find(j => !j.targetDevice && j.id !== excludeId);
  if (conflict) {
    throw new Error(`Global ping job already exists (${conflict.name}). Use site or device targeting instead.`);
  }
}

router.get('/', requirePermission('jobs.view'), async (_req, res) => {
  try {
    const rows = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

router.get('/:id/history', requirePermission('jobs.view'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const history = await getJobHistory(id);
    res.json({ data: history, total: history.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch job history' });
  }
});

router.post('/', requirePermission('jobs.manage'), async (req: AuthRequest, res) => {
  try {
    const parsed = parseBody(jobCreateSchema, req.body);
    if (parsed.error) { res.status(400).json({ error: parsed.error }); return; }
    const { name, type, description, targetDevice, frequency, cron, owner, enabled, status } = parsed.data!;
    await assertSingleGlobalPing(type || 'Device Ping Check', targetDevice, enabled !== false);

    const existing = await db.select().from(jobs);
    const newId = `JOB-${String(existing.length + 1).padStart(3, '0')}`;

    await db.insert(jobs).values({
      id: newId,
      name,
      type: type || 'Device Ping Check',
      description,
      targetDevice: targetDevice || null,
      frequency: frequency || 'Daily',
      cron: cron || null,
      owner: owner || req.user?.name || req.user?.email || 'system',
      enabled: enabled !== undefined ? enabled : true,
      status: (status || 'scheduled') as 'scheduled',
    });

    await reloadScheduler();
    res.status(201).json({ success: true, id: newId });
  } catch (err: any) {
    console.error(err);
    res.status(err.message?.includes('Global ping') ? 400 : 500).json({ error: err.message || 'Failed to create job' });
  }
});

router.post('/:id/run', requirePermission('jobs.run'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    await runJobNow(id);
    res.json({ success: true, message: `Job "${job.name}" started` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to run job' });
  }
});

router.post('/:id/pause', requirePermission('jobs.manage'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    await pauseJob(id);
    res.json({ success: true, message: `Job "${job.name}" paused` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to pause job' });
  }
});

router.post('/:id/resume', requirePermission('jobs.manage'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    await resumeJob(id);
    res.json({ success: true, message: `Job "${job.name}" resumed` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resume job' });
  }
});

router.put('/:id', requirePermission('jobs.manage'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, type, description, targetDevice, frequency, cron, owner, enabled, status, progress, duration, lastRun, nextRun } = req.body;

    await assertSingleGlobalPing(type, targetDevice, enabled !== false, id);

    await db.update(jobs)
      .set({
        name, type, description,
        targetDevice: targetDevice || null,
        frequency, cron, owner,
        enabled, status, progress, duration,
        lastRun: lastRun ? new Date(lastRun) : undefined,
        nextRun: nextRun ? new Date(nextRun) : undefined,
      })
      .where(eq(jobs.id, id));

    await reloadScheduler();
    res.json({ success: true });
  } catch (err: any) {
    console.error(err);
    res.status(err.message?.includes('Global ping') ? 400 : 500).json({ error: err.message || 'Failed to update job' });
  }
});

router.delete('/:id', requirePermission('jobs.manage'), async (req, res) => {
  try {
    const id = req.params.id as string;
    await db.delete(jobs).where(eq(jobs.id, id));
    await reloadScheduler();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

export default router;
