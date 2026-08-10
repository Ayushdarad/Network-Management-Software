import { Router } from 'express';
import { db } from '../db/connection.js';
import { assets } from '../db/schema.js';
import { desc, eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/assets
router.get('/', requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(assets).orderBy(desc(assets.createdAt));
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// POST /api/assets
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, owner, category, status } = req.body;
    
    // Generate an ID like AST-005
    const existing = await db.select().from(assets);
    const newId = `AST-${String(existing.length + 1).padStart(3, '0')}`;

    await db.insert(assets).values({
      id: newId,
      name,
      owner,
      category,
      status: status || 'review'
    });
    
    res.status(201).json({ success: true, id: newId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// PUT /api/assets/:id
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    const { name, owner, category, status } = req.body;
    
    await db.update(assets)
      .set({ name, owner, category, status })
      .where(eq(assets.id, id));
      
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// DELETE /api/assets/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = req.params.id as string;
    await db.delete(assets).where(eq(assets.id, id));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

export default router;
