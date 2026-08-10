import { Request, Response, NextFunction } from 'express';
import { logAudit } from '../db/audit.js';
import type { AuthRequest } from './auth.js';

export function auditMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // Only log modifying requests
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.on('finish', () => {
      // Don't log if the user isn't authenticated yet (e.g. login is handled separately in auth.ts)
      if (!req.user) return;

      let action = `${req.method}_${req.originalUrl.split('/')[2]?.toUpperCase() || 'RESOURCE'}`;
      
      // Try to make the action more descriptive based on URL patterns
      if (req.originalUrl.includes('/acknowledge')) action = 'ACKNOWLEDGE_ALERT';
      else if (req.originalUrl.includes('/resolve')) action = 'RESOLVE_ALERT';
      else if (req.originalUrl.includes('/poll')) action = 'DEVICE_POLL';
      else if (req.originalUrl.includes('/run')) action = 'JOB_RUN';
      else if (req.originalUrl.includes('/pause')) action = 'JOB_PAUSE';
      else if (req.method === 'POST') action = `CREATE_${req.originalUrl.split('/')[2]?.toUpperCase() || 'RESOURCE'}`;
      else if (req.method === 'PUT') action = `UPDATE_${req.originalUrl.split('/')[2]?.toUpperCase() || 'RESOURCE'}`;
      else if (req.method === 'DELETE') action = `DELETE_${req.originalUrl.split('/')[2]?.toUpperCase() || 'RESOURCE'}`;

      // Extract resource ID if present in the URL (e.g., /api/alerts/ALT-123)
      const parts = req.originalUrl.split('/');
      let resource = parts.length >= 4 ? parts[3] : parts[2];
      
      // Clean up query parameters if they exist in the resource string
      if (resource && resource.includes('?')) {
        resource = resource.split('?')[0];
      }

      logAudit({
        userId: req.user.id,
        userName: req.user.name,
        userRole: req.user.role,
        action: action,
        resource: resource || 'System',
        method: req.method,
        path: req.originalUrl,
        ip: req.ip || '',
        result: res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failed',
        detail: `Status Code: ${res.statusCode}`
      }).catch(err => console.error('Audit Middleware Error:', err));
    });
  }
  next();
}
