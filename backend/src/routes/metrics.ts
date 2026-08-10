import { Router } from 'express';
import { db } from '../db/connection.js';
import { metrics, devices } from '../db/schema.js';
import { desc, gte, eq } from 'drizzle-orm';

const router = Router();

// GET /api/metrics/traffic — aggregate inbound/outbound from stored metrics (last 30 snapshots)
router.get('/traffic', async (_req, res) => {
  try {
    const since = new Date(Date.now() - 3 * 60 * 60 * 1000); // last 3 hours
    const rows = await db
      .select()
      .from(metrics)
      .where(gte(metrics.createdAt, since))
      .orderBy(desc(metrics.createdAt))
      .limit(30);

    const ordered = rows.reverse();
    res.json({
      inbound:  ordered.map(r => Math.round(r.inbound  ?? 0)),
      outbound: ordered.map(r => Math.round(r.outbound ?? 0)),
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch traffic metrics' });
  }
});

// GET /api/metrics/cpu — per-device CPU from stored metrics
router.get('/cpu', async (_req, res) => {
  try {
    const devs = await db.select().from(devices).limit(6);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const series = await Promise.all(devs.map(async d => {
      const rows = await db
        .select()
        .from(metrics)
        .where(gte(metrics.createdAt, since))
        .orderBy(desc(metrics.createdAt))
        .limit(24);
      const data = rows.filter(r => r.deviceId === d.id).reverse().map(r => +(r.cpu ?? 0).toFixed(1));
      return { name: d.hostname, data };
    }));

    res.json({ data: series });
  } catch {
    res.status(500).json({ error: 'Failed to fetch CPU metrics' });
  }
});

// GET /api/metrics/bandwidth — per-device inbound/outbound from stored metrics
router.get('/bandwidth', async (_req, res) => {
  try {
    const devs = await db.select().from(devices).limit(5);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const rows = await db
      .select()
      .from(metrics)
      .where(gte(metrics.createdAt, since))
      .orderBy(desc(metrics.createdAt))
      .limit(200);

    const data = devs.map(d => {
      const devRows = rows.filter(r => r.deviceId === d.id).reverse();
      return {
        deviceId: d.id,
        hostname: d.hostname,
        inbound:  devRows.reduce((s, r) => s + (r.inbound  ?? 0), 0) / (devRows.length || 1),
        outbound: devRows.reduce((s, r) => s + (r.outbound ?? 0), 0) / (devRows.length || 1),
      };
    });

    res.json({ data });
  } catch {
    res.status(500).json({ error: 'Failed to fetch bandwidth metrics' });
  }
});

// GET /api/metrics/device/:id — stored snapshots for one device
router.get('/device/:id', async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select()
      .from(metrics)
      .where(gte(metrics.createdAt, since))
      .orderBy(desc(metrics.createdAt))
      .limit(48);
    res.json({ data: rows.filter(r => r.deviceId === req.params.id).reverse() });
  } catch {
    res.status(500).json({ error: 'Failed to fetch device metrics' });
  }
});

export default router;
