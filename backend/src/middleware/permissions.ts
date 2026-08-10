import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.js';
import { roleHasPermission } from '../routes/settings.js';

/** Require the user's role to have at least one of the given permissions. */
export function requirePermission(...permissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const allowed = permissions.some(p => roleHasPermission(req.user!.role, p));
    if (!allowed) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

/** Require any one of the permissions (alias for clarity). */
export const requireAnyPermission = requirePermission;
