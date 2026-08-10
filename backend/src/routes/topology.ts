import { Router } from 'express';
import { db } from '../db/connection.js';
import { topologyNodes, topologyEdges, devices } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /api/topology/nodes — returns nodes enriched with live device data
router.get('/nodes', async (_req, res) => {
  try {
    const nodes = await db.select().from(topologyNodes);
    const allDevices = await db.select().from(devices);
    const deviceMap = Object.fromEntries(allDevices.map(d => [d.id, d]));

    const enriched = nodes.map(n => {
      const dev = deviceMap[n.id];
      return {
        id: n.id,
        type: 'deviceNode',
        position: { x: n.posX, y: n.posY },
        data: {
          label: dev?.hostname || n.id,
          hostname: dev?.hostname,
          ip: dev?.ip,
          deviceType: n.deviceType,
          vendor: dev?.vendor,
          status: dev?.status || 'unknown',
          interfaces: dev?.interfaces || 0,
          cpu: dev?.cpu,
          memory: dev?.memory,
        }
      };
    });

    res.json({ data: enriched });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch topology nodes' });
  }
});

// GET /api/topology/edges
router.get('/edges', async (_req, res) => {
  try {
    const edges = await db.select().from(topologyEdges);
    res.json({ data: edges });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch topology edges' });
  }
});

// PUT /api/topology/nodes/:id/position — save drag position
router.put('/nodes/:id/position', async (req, res) => {
  try {
    const { x, y } = req.body;
    if (x == null || y == null) {
      res.status(400).json({ error: 'x and y are required' });
      return;
    }
    await db.update(topologyNodes)
      .set({ posX: x, posY: y })
      .where(eq(topologyNodes.id, req.params.id));
    res.json({ message: 'Position saved' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save position' });
  }
});

export default router;
