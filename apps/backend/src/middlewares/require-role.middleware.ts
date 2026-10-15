import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';

export function requireRole(...roles: Array<'ADMIN' | 'AGENT' | 'USER'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const payload = token ? AuthService.verifyToken(token) : null;
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
