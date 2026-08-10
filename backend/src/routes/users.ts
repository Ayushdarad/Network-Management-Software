import { Router } from 'express';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const router = Router();

const safeUser = (u: typeof users.$inferSelect) => {
  const { password: _, ...rest } = u;
  return rest;
};

// GET /api/users
router.get('/', async (_req, res) => {
  try {
    const rows = await db.select().from(users);
    res.json({ data: rows.map(safeUser), total: rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, Number(req.params.id)));
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json(safeUser(user));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'name, email and password are required' });
      return;
    }
    const hashed = await bcrypt.hash(password, 10);
    await db.insert(users).values({ name, email, password: hashed, role: role || 'viewer' });
    const [created] = await db.select().from(users).where(eq(users.email, email));
    res.status(201).json(safeUser(created));
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create user' });
    }
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [exists] = await db.select().from(users).where(eq(users.id, id));
    if (!exists) { res.status(404).json({ error: 'User not found' }); return; }

    const updates: any = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.role) updates.role = req.body.role;
    if (req.body.status) updates.status = req.body.status;
    if (req.body.password) updates.password = await bcrypt.hash(req.body.password, 10);

    await db.update(users).set(updates).where(eq(users.id, id));
    const [updated] = await db.select().from(users).where(eq(users.id, id));
    res.json(safeUser(updated));
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.delete(users).where(eq(users.id, Number(req.params.id)));
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
