import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db, UserRecord } from './db.js';

let developmentSecret: string | undefined;
function getJwtSecret(): string | undefined {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') return undefined;
  developmentSecret ??= randomBytes(48).toString('hex');
  return developmentSecret;
}

export function assertAuthConfiguration(): void {
  if (process.env.NODE_ENV === 'production' && !getJwtSecret()) {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production.');
  }
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateToken(user: { id: string; email: string; tokenVersion?: number }): string {
  const secret = getJwtSecret();
  if (!secret) throw new Error('Authentication is unavailable until JWT_SECRET is configured.');
  return jwt.sign(
    { sub: user.id, email: user.email, ver: user.tokenVersion || 0 },
    secret,
    { expiresIn: '7d', algorithm: 'HS256', issuer: 'easecareer' }
  );
}

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = getJwtSecret();
    if (!secret) return res.status(503).json({ error: 'Authentication is temporarily unavailable.' });
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'easecareer' }) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string' ||
        (payload.ver !== undefined && !Number.isInteger(payload.ver))) {
      return res.status(401).json({ error: 'Invalid or expired session token.' });
    }
    const user = db.findUserById(payload.sub);
    if (!user || user.email !== payload.email || (payload.ver ?? 0) !== (user.tokenVersion || 0)) {
      return res.status(401).json({ error: 'User account not found or expired.' });
    }
    req.user = user;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const secret = getJwtSecret();
      if (!secret) return next();
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'easecareer' }) as jwt.JwtPayload;
      const user = typeof payload.sub === 'string' && typeof payload.email === 'string' ? db.findUserById(payload.sub) : undefined;
      if (user && user.email === payload.email && (payload.ver ?? 0) === (user.tokenVersion || 0)) {
        req.user = user;
      }
    } catch {
      // ignore
    }
  }
  next();
}
