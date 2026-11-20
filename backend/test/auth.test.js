import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, tokenHash, readToken, cookieOptions, sessionCookie } from '../src/lib/auth.js';
import { createApp } from '../src/app.js';
test('passwords use random salts and reject the wrong password', async () => {
  const first = await hashPassword('correct-test-password');
  assert.notEqual(first, await hashPassword('correct-test-password'));
  assert.equal(await verifyPassword('correct-test-password', first), true);
  assert.equal(await verifyPassword('wrong-test-password', first), false);
});
test('sessions require a full random token and store only its digest', () => {
  assert.equal(readToken({ headers: { cookie: 'shopsmart_session=bad' } }), null);
  const token = 'a'.repeat(64);
  assert.equal(readToken({ headers: { cookie: 'other=1; shopsmart_session=' + token } }), token);
  assert.notEqual(tokenHash(token), token);
  assert.equal(cookieOptions().httpOnly, true);
  assert.equal(cookieOptions().sameSite, 'lax');
});
test('HTTP API rejects guests, foreign origins, and non-JSON mutations before database access', async (t) => {
  const db = new Proxy({}, { get() { throw Error('Database must not be used'); } });
  const server = createApp({ db }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const path of ['/api/orders', '/api/orders/1', '/api/auth/me']) {
    assert.equal((await fetch(base + path)).status, 401);
  }
  assert.equal((await fetch(base + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401);
  assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', headers: { Origin: 'https://foreign.example', 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(base + '/api/auth/login', { method: 'POST', body: '{}' })).status, 415);
});

test('production cookies require HTTPS and a host-only cookie name', () => {
  const previous = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    assert.equal(cookieOptions().secure, true);
    assert.equal(cookieOptions().path, '/');
    assert.equal(cookieOptions().domain, undefined);
    assert.equal(sessionCookie(), '__Host-shopsmart_session');
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});
