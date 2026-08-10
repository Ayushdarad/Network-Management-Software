import { Router } from 'express';
import { db } from '../db/connection.js';
import { alerts } from '../db/schema.js';
import { eq, like, and, or, desc } from 'drizzle-orm';
import type { AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissions.js';

const router = Router();

router.get('/', requirePermission('alerts.view'), async (req, res) => {
  try {
    const { severity, status, site, search } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (severity) conditions.push(eq(alerts.severity, severity as any));
    if (status) conditions.push(eq(alerts.status, status as any));
    if (site) conditions.push(eq(alerts.site, site));
    if (search) conditions.push(
      or(
        like(alerts.title, `%${search}%`),
        like(alerts.device, `%${search}%`),
        like(alerts.description, `%${search}%`)
      )
    );

    const rows = conditions.length
      ? await db.select().from(alerts).where(and(...conditions)).orderBy(desc(alerts.createdAt))
      : await db.select().from(alerts).orderBy(desc(alerts.createdAt));

    const serialize = (row: typeof rows[0]) => {
      const createdAt  = row.createdAt  instanceof Date ? row.createdAt.toISOString()  : row.createdAt as unknown as string;
      const updatedAt  = row.updatedAt  instanceof Date ? row.updatedAt.toISOString()  : row.updatedAt as unknown as string;
      return { ...row, createdAt, updatedAt };
    };

    const data = rows.map(serialize);
    const counts = {
      critical: data.filter(a => a.severity === 'critical' && a.status === 'active').length,
      warning:  data.filter(a => a.severity === 'warning'  && a.status === 'active').length,
      info:     data.filter(a => a.severity === 'info'     && a.status === 'active').length,
      total:    data.length,
    };

    res.json({ data, counts, total: data.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

router.get('/:id', requirePermission('alerts.view'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, id));
    if (!alert) { res.status(404).json({ error: 'Alert not found' }); return; }
    res.json({
      ...alert,
      createdAt: alert.createdAt instanceof Date ? alert.createdAt.toISOString() : alert.createdAt,
      updatedAt: alert.updatedAt instanceof Date ? alert.updatedAt.toISOString() : alert.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

router.post('/:id/acknowledge', requirePermission('alerts.acknowledge'), async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, id));
    if (!alert) { res.status(404).json({ error: 'Alert not found' }); return; }

    await db.update(alerts).set({
      status: 'acknowledged',
      acknowledgedBy: req.user?.name || req.body.by || 'operator',
      updatedAt: new Date(),
    }).where(eq(alerts.id, id));

    const [updated] = await db.select().from(alerts).where(eq(alerts.id, id));
    res.json({
      ...updated,
      createdAt: updated!.createdAt instanceof Date ? updated!.createdAt.toISOString() : updated!.createdAt,
      updatedAt: updated!.updatedAt instanceof Date ? updated!.updatedAt.toISOString() : updated!.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

router.post('/:id/resolve', requirePermission('alerts.resolve'), async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, id));
    if (!alert) { res.status(404).json({ error: 'Alert not found' }); return; }

    await db.update(alerts).set({
      status: 'resolved',
      updatedAt: new Date(),
    }).where(eq(alerts.id, id));

    const [updated] = await db.select().from(alerts).where(eq(alerts.id, id));
    res.json({
      ...updated,
      createdAt: updated!.createdAt instanceof Date ? updated!.createdAt.toISOString() : updated!.createdAt,
      updatedAt: updated!.updatedAt instanceof Date ? updated!.updatedAt.toISOString() : updated!.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

router.delete('/:id', requirePermission('alerts.delete'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const [exists] = await db.select().from(alerts).where(eq(alerts.id, id));
    if (!exists) { res.status(404).json({ error: 'Alert not found' }); return; }
    await db.delete(alerts).where(eq(alerts.id, id));
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;
