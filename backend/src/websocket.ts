import { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { db } from './db/connection.js';
import { alerts, devices } from './db/schema.js';
import { eq } from 'drizzle-orm';
import { getAllowedOrigins, getJwtSecret } from './config.js';

let io: IOServer;

function extractToken(socket: Socket): string | undefined {
  const auth = socket.handshake.auth?.token;
  if (typeof auth === 'string' && auth.length > 0) return auth;
  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  return undefined;
}

export function initWebSocket(httpServer: HttpServer) {
  io = new IOServer(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      methods: ['GET', 'POST'],
      credentials: true,
    }
  });

  io.use((socket, next) => {
    const token = extractToken(socket);
    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }
    try {
      const payload = jwt.verify(token, getJwtSecret()) as { id: string; email: string; role: string; name: string };
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id} (${socket.data.user?.email ?? 'unknown'})`);

    sendAlertCount(socket);
    sendLiveMetrics(socket);

    socket.on('subscribe:device', (deviceId: string) => {
      socket.join(`device:${deviceId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): IOServer {
  return io;
}

// ─── Broadcast helpers ─────────────────────────────────────────────────────────

export async function sendAlertCount(socket?: any) {
  try {
    const allAlerts = await db.select().from(alerts);
    const activeCount = allAlerts.filter(a => a.status === 'active').length;
    const payload = { activeAlerts: activeCount, total: allAlerts.length };
    if (socket) socket.emit('alerts:count', payload);
    else io?.emit('alerts:count', payload);
  } catch { /* ignore */ }
}

async function sendLiveMetrics(socket?: any) {
  try {
    const allDevices = await db.select().from(devices).limit(20);
    const payload = allDevices.map(d => ({
      id: d.id,
      hostname: d.hostname,
      status: d.status,
    }));
    if (socket) socket.emit('metrics:snapshot', payload);
    else io?.emit('metrics:snapshot', payload);
  } catch { /* ignore */ }
}

// ─── Periodic broadcast (called from scheduler) ────────────────────────────────

export async function broadcastMetricsUpdate() {
  if (!io) return;
  await sendLiveMetrics();
}

export async function broadcastAlertEvent(event: 'alert:new' | 'alert:updated', alertId: string) {
  if (!io) return;
  try {
    const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId));
    if (alert) {
      io.emit(event, alert);
      await sendAlertCount();
    }
  } catch { /* ignore */ }
}

export async function broadcastJobProgress(jobId: string, progress: number) {
  if (!io) return;
  io.emit('job:progress', { jobId, progress });
}

export function broadcastJobUpdate(jobId: string, patch: Record<string, unknown>) {
  if (!io) return;
  io.emit('job:update', { jobId, ...patch });
}
