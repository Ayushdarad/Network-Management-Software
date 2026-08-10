import { Router } from 'express';
import { db } from '../db/connection.js';
import { devices, metrics } from '../db/schema.js';
import { eq, like, and, or, desc } from 'drizzle-orm';
import type { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';
import { deviceCreateSchema, deviceUpdateSchema, parseBody } from '../lib/validation.js';
import { syncDeviceTimelineFromStatus } from '../lib/timelineSync.js';

const router = Router();

function serializeDevice(row: any) {
  return {
    ...row,
    lastSeen:  row.lastSeen  instanceof Date ? row.lastSeen.toISOString()  : row.lastSeen,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

router.get('/', requirePermission('devices.view', 'inventory.view'), async (req, res) => {
  try {
    const { status, site, type, search } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (status) conditions.push(eq(devices.status, status as any));
    if (site) conditions.push(eq(devices.site, site));
    if (type) conditions.push(eq(devices.type, type as any));
    if (search) conditions.push(
      or(
        like(devices.hostname, `%${search}%`),
        like(devices.ip, `%${search}%`),
        like(devices.vendor, `%${search}%`),
        like(devices.model, `%${search}%`)
      )
    );

    const rows = conditions.length
      ? await db.select().from(devices).where(and(...conditions))
      : await db.select().from(devices);

    res.json({ data: rows.map(serializeDevice), total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

router.get('/:id', requirePermission('devices.view', 'inventory.view'), async (req, res) => {
  try {
    const [device] = await db.select().from(devices).where(eq(devices.id, req.params.id as string));
    if (!device) { res.status(404).json({ error: 'Device not found' }); return; }
    res.json(serializeDevice(device));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

router.post('/', requirePermission('devices.create'), async (req, res) => {
  try {
    const parsed = parseBody(deviceCreateSchema, req.body);
    if (parsed.error) { res.status(400).json({ error: parsed.error }); return; }
    const d = parsed.data!;
    const id = `D${String(Date.now()).slice(-4)}`;
    await db.insert(devices).values({
      id,
      hostname: d.hostname,
      ip: d.ip,
      type: d.type,
      vendor: d.vendor,
      model: d.model,
      location: d.location,
      site: d.site,
      os: d.os ?? '',
      status: d.status ?? 'unknown',
      tags: d.tags ?? [],
      lastSeen: new Date(),
    });
    const [created] = await db.select().from(devices).where(eq(devices.id, id));
    res.status(201).json(serializeDevice(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create device' });
  }
});

router.put('/:id', requirePermission('devices.edit'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const parsed = parseBody(deviceUpdateSchema, req.body);
    if (parsed.error) { res.status(400).json({ error: parsed.error }); return; }
    const [exists] = await db.select().from(devices).where(eq(devices.id, id));
    if (!exists) { res.status(404).json({ error: 'Device not found' }); return; }

    const newId = req.body.id?.trim();
    const { id: _id, ...rest } = { ...parsed.data, ...req.body };

    if (newId && newId !== id) {
      const [conflict] = await db.select().from(devices).where(eq(devices.id, newId));
      if (conflict) { res.status(409).json({ error: `Device ID "${newId}" already exists` }); return; }

      await db.insert(devices).values({ ...exists, ...rest, id: newId, updatedAt: new Date() });
      await db.delete(devices).where(eq(devices.id, id));
      const [updated] = await db.select().from(devices).where(eq(devices.id, newId));
      res.json(serializeDevice(updated));
    } else {
      await db.update(devices).set({ ...rest, updatedAt: new Date() }).where(eq(devices.id, id));
      const [updated] = await db.select().from(devices).where(eq(devices.id, id));
      if (rest.status !== undefined && rest.status !== exists.status) {
        await syncDeviceTimelineFromStatus(updated);
      }
      res.json(serializeDevice(updated));
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

router.delete('/:id', requirePermission('devices.delete'), async (req, res) => {
  try {
    const [exists] = await db.select().from(devices).where(eq(devices.id, req.params.id as string));
    if (!exists) { res.status(404).json({ error: 'Device not found' }); return; }
    await db.delete(devices).where(eq(devices.id, req.params.id as string));
    res.json({ message: 'Device deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

router.get('/:id/metrics', requirePermission('devices.view'), async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(metrics)
      .where(eq(metrics.deviceId, req.params.id as string))
      .orderBy(desc(metrics.createdAt))
      .limit(48);
    res.json({ data: rows.reverse() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

import { pollDevice } from '../pingMonitor.js';

router.post('/:id/poll', requirePermission('devices.poll'), async (req, res) => {
  try {
    const id = req.params.id as string;
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    if (!device) { res.status(404).json({ error: 'Device not found' }); return; }

    const result = await pollDevice(device);

    const [updated] = await db.select().from(devices).where(eq(devices.id, id));
    res.json({ message: 'Poll triggered', device: serializeDevice(updated), reachable: result.reachable });
  } catch (err) {
    res.status(500).json({ error: 'Poll failed' });
  }
});

export default router;
