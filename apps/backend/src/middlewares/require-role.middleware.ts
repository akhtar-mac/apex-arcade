import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { readAccessToken } from '../services/session-cookie.js';

export function requireRole(...roles: Array<'ADMIN' | 'AGENT' | 'USER'>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = readAccessToken(req);
    const payload = token ? await AuthService.verifyToken(token) : null;
    if (!payload) {
      return res.status(401).json({ success: false, error: 'Login required.' });
    }
    if (roles.length > 0 && !roles.includes(payload.role as 'ADMIN' | 'AGENT' | 'USER')) {
      return res.status(403).json({ success: false, error: 'This account cannot do that.' });
    }
    (req as any).user = payload;
    return next();
  };
}
