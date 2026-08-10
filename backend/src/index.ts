import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { initWebSocket } from './websocket.js';
import { getAllowedOrigins } from './config.js';
import { pool } from './db/connection.js';

// Routes
import authRouter from './routes/auth.js';
import devicesRouter from './routes/devices.js';
import alertsRouter from './routes/alerts.js';
import jobsRouter from './routes/jobs.js';
import logsRouter from './routes/logs.js';
import metricsRouter from './routes/metrics.js';
import usersRouter from './routes/users.js';
import settingsRouter from './routes/settings.js';
import assetsRouter from './routes/assets.js';
import timelineRouter from './routes/timeline.js';
import { requireAuth } from './middleware/auth.js';
import { requirePermission } from './middleware/permissions.js';
import { auditMiddleware } from './middleware/audit.js';

const app = express();
const httpServer = createServer(app);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: isProd ? undefined : false }));
app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
});

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString(), service: 'Tecsidel NMS API' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'disconnected', timestamp: new Date().toISOString(), service: 'Tecsidel NMS API' });
  }
});

// ─── Public Routes ────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRouter);

// ─── Protected Routes ─────────────────────────────────────────────────────────
app.use('/api/devices', requireAuth, auditMiddleware, devicesRouter);
app.use('/api/devices', requireAuth, timelineRouter);
app.use('/api/alerts', requireAuth, auditMiddleware, alertsRouter);
app.use('/api/jobs', requireAuth, auditMiddleware, jobsRouter);
app.use('/api/logs', requireAuth, auditMiddleware, logsRouter);
app.use('/api/metrics', requireAuth, auditMiddleware, metricsRouter);
app.use('/api/users', requireAuth, requirePermission('users.view'), auditMiddleware, usersRouter);
app.use('/api/settings', requireAuth, auditMiddleware, settingsRouter);
app.use('/api/assets', requireAuth, auditMiddleware, assetsRouter);

// ─── Production: serve built frontend ───────────────────────────────────────
if (isProd) {
  const frontendDist = path.resolve(__dirname, '../../dist');
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api|\/socket\.io|\/health).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[Error]', err);
  res.status(500).json({ error: isProd ? 'Internal server error' : (err.message || 'Internal server error') });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3001;

initWebSocket(httpServer);
import('./scheduler.js');

httpServer.listen(PORT, () => {
  console.log(`\n🚀 Tecsidel NMS API running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready`);
  console.log(`🏥 Health: http://localhost:${PORT}/health\n`);
});
