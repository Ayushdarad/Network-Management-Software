import { db } from './connection.js';
import { auditLogs } from './schema.js';

export async function logAudit(params: {
  userId?: number;
  userName?: string;
  userRole?: string;
  action: string;
  resource?: string;
  method?: string;
  path?: string;
  ip?: string;
  result?: 'success' | 'failed';
  detail?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      ...params,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
