import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { hashPassword, verifyPassword, requireAuth, startSession, readToken, tokenHash, sessionCookie, cookieOptions } from '../lib/auth.js';
const credentials = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)), password: z.string().min(12).max(128) });
const registration = credentials.extend({ name: z.string().trim().min(2).max(80) });
// A fixed dummy hash keeps nonexistent accounts on the same password-verification path.
const dummyHash = await hashPassword('unused-dummy-password');
export function createAuthRouter(db) {
  const router = Router();
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'AUTH_RATE_LIMIT', message: 'Too many attempts. Try again in 15 minutes.' } } });
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.get('/me', requireAuth(db), (request, response) => response.json({ user: request.user }));
  router.post('/register', limiter, async (request, response, next) => {
    const parsed = registration.safeParse(request.body);
    if (!parsed.success) return response.status(422).json({ error: { code: 'INVALID_ACCOUNT', message: 'Use a valid email, a name of 2-80 characters, and a password of 12-128 characters.' } });
    try {
      const { name, email, password } = parsed.data;
      const user = await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) }, select: { id: true, name: true, email: true } });
      await startSession(db, user.id, request, response);
      response.status(201).json({ user });
    } catch (error) {
      if (error.code === 'P2002') return response.status(409).json({ error: { code: 'ACCOUNT_EXISTS', message: 'Unable to create this account. Try signing in.' } });
      next(error);
    }
  });
  router.post('/login', limiter, async (request, response, next) => {
    const parsed = credentials.safeParse(request.body);
    if (!parsed.success) return response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    try {
      const user = await db.user.findUnique({ where: { email: parsed.data.email } });
      const valid = await verifyPassword(parsed.data.password, user?.passwordHash || dummyHash);
      if (!user || !valid) return response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
      await startSession(db, user.id, request, response);
      response.json({ user: { id: user.id, name: user.name, email: user.email } });
    } catch (error) { next(error); }
  });
  router.post('/logout', async (request, response, next) => {
    try {
      const token = readToken(request);
      if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
      response.clearCookie(sessionCookie(), cookieOptions());
      response.status(204).end();
    } catch (error) { next(error); }
  });
  return router;
}
