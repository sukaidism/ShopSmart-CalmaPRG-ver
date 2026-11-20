import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const sessionCookie = () => process.env.NODE_ENV === 'production' ? '__Host-shopsmart_session' : 'shopsmart_session';
export const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const key = await derive(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return salt + ':' + key.toString('hex');
}
export async function verifyPassword(password, stored) {
  const candidate = await hashPassword(password, stored.split(':')[0]);
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(stored));
}
export function readToken(request) {
  const value = (request.headers.cookie || '').split(';').map((v) => v.trim()).find((v) => v.startsWith(sessionCookie() + '='));
  const token = value?.slice(sessionCookie().length + 1);
  return /^[a-f0-9]{64}$/.test(token || '') ? token : null;
}
export function requireAuth(db) {
  return async (request, response, next) => {
    try {
      const token = readToken(request);
      const session = token && await db.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
      if (!session || session.expiresAt <= new Date()) return response.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Please sign in to continue.' } });
      request.user = { id: session.user.id, name: session.user.name, email: session.user.email };
      next();
    } catch (error) { next(error); }
  };
}
export async function startSession(db, userId, request, response) {
  const oldToken = readToken(request);
  if (oldToken) await db.session.deleteMany({ where: { tokenHash: tokenHash(oldToken) } });
  const token = randomBytes(32).toString('hex');
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  await db.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + maxAge) } });
  response.cookie(sessionCookie(), token, { ...cookieOptions(), maxAge });
}
