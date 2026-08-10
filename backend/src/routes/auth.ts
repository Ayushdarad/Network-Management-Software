import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/connection.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { AuthRequest } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { getJwtSecret } from '../config.js';

// Track active sessions in memory (userId → Set of token expiries)
const activeSessions = new Map<number, number>();

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (user.status === 'inactive') {
      res.status(403).json({ error: 'Account is inactive' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      getJwtSecret(),
      { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as any }
    );

    // Mark user online with last login timestamp
    await db.update(users)
      .set({ isOnline: true, lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Log audit event
    import('../db/audit.js').then(({ logAudit }) => {
      logAudit({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: 'USER_LOGIN',
        resource: 'NMS Portal',
        ip: req.ip || '',
        result: 'success'
      });
    }).catch(console.error);

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (req.user?.id) {
      await db.update(users)
        .set({ isOnline: false })
        .where(eq(users.id, req.user.id));
    }
  } catch { /* non-fatal */ }
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      // Don't leak if user exists, just return success
      res.json({ message: 'If that email exists, a reset link has been sent.' });
      return;
    }

    // Generate random 64-char token (using native crypto)
    const tokenBytes = new Uint8Array(48);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Expires in 1 hour
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    await db.update(users)
      .set({ resetToken: token, resetExpires: expires })
      .where(eq(users.id, user.id));

    // SIMULATE EMAIL SEND BY PRINTING TO TERMINAL
    console.log('\n======================================================');
    console.log('📧 MOCK EMAIL SENT');
    console.log(`To: ${user.email}`);
    console.log('Subject: Reset your password');
    console.log(`Link: http://localhost:5173/reset-password?token=${token}`);
    console.log('======================================================\n');

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    res.status(400).json({ error: 'Token and new password are required' });
    return;
  }

  try {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
    
    if (!user || !user.resetExpires || new Date() > user.resetExpires) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.update(users)
      .set({ password: hashed, resetToken: null, resetExpires: null })
      .where(eq(users.id, user.id));

    res.json({ message: 'Password reset successfully. You can now login.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
