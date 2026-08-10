import { Router } from 'express';
import { db } from '../db/connection.js';
import { logs, auditLogs } from '../db/schema.js';
import { eq, like, and, or, gte, lte, desc } from 'drizzle-orm';

const router = Router();

// GET /api/logs
router.get('/', async (req, res) => {
  try {
    const { level, device, search, from, to, limit = '200' } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (level) conditions.push(eq(logs.level, level as any));
    if (device) conditions.push(like(logs.source, `%${device}%`));
    if (search) conditions.push(like(logs.message, `%${search}%`));
    if (from) conditions.push(gte(logs.createdAt, new Date(from)));
    if (to) conditions.push(lte(logs.createdAt, new Date(to)));

    const rows = conditions.length
      ? await db.select().from(logs)
          .where(and(...conditions))
          .orderBy(desc(logs.createdAt))
          .limit(Number(limit))
      : await db.select().from(logs)
          .orderBy(desc(logs.createdAt))
          .limit(Number(limit));

    const data = rows.map(r => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    }));
    res.json({ data, total: data.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET /api/logs/audit
router.get('/audit', async (req, res) => {
  try {
    const { user, action, search, limit = '200' } = req.query as Record<string, string>;
    
    const conditions: any[] = [];
    if (user) conditions.push(like(auditLogs.userName, `%${user}%`));
    if (action) conditions.push(like(auditLogs.action, `%${action}%`));
    if (search) conditions.push(
      or(
        like(auditLogs.resource, `%${search}%`),
        like(auditLogs.detail, `%${search}%`)
      )
    );

    const rows = conditions.length
      ? await db.select().from(auditLogs)
          .where(and(...conditions))
          .orderBy(desc(auditLogs.createdAt))
          .limit(Number(limit))
      : await db.select().from(auditLogs)
          .orderBy(desc(auditLogs.createdAt))
          .limit(Number(limit));

    res.json({ data: rows, total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
