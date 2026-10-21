import { Request, Response } from 'express';
import { Config } from '../config.js';

export const SESSION_COOKIE = 'apex_session';

export function readCookie(req: Request, name: string): string {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

export function readAccessToken(req: Request): string {
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return bearer || readCookie(req, SESSION_COOKIE);
}

export function sessionCookie(token: string): string {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'HttpOnly', 'Path=/', 'Max-Age=3600', 'SameSite=Lax'];
  if (Config.isPublicDeployment) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(): string {
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
  if (Config.isPublicDeployment) parts.push('Secure');
  return parts.join('; ');
}

export function attachSession(res: Response, token: string): void {
  res.setHeader('Set-Cookie', sessionCookie(token));
}
