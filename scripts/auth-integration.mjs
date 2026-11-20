// Uses a uniquely named PostgreSQL schema, never the application's tables.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { createApp } from '../backend/src/app.js';
import { tokenHash } from '../backend/src/lib/auth.js';
dotenv.config({ path: 'backend/.env', quiet: true });
const schema = 'auth_test_' + randomBytes(8).toString('hex');
assert.match(schema, /^auth_test_[a-f0-9]{16}$/);
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', schema);
const db = new PrismaClient({ datasources: { db: { url: url.href } } });
let server;
let vite;
let browser;
if (process.argv.includes('--browser')) process.env.FRONTEND_URL = 'http://127.0.0.1:5179';
try {
  await db.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
  for (const dir of (await readdir('backend/prisma/migrations')).filter((name) => /^\d/.test(name)).sort()) {
    const sql = await readFile('backend/prisma/migrations/' + dir + '/migration.sql', 'utf8');
    for (const statement of sql.replace(/--[^\n]*/g, '').split(';').filter((s) => s.trim())) await db.$executeRawUnsafe(statement);
  }
  const origin = new URL(process.env.FRONTEND_URL || 'http://localhost:5173').origin;
  server = createApp({ db }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  async function request(path, { method = 'GET', cookie, data, status = 200, requestOrigin = origin } = {}) {
    const response = await fetch(base + path, { method, headers: { Origin: requestOrigin, ...(cookie ? { Cookie: cookie } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    const body = response.status === 204 ? null : await response.json();
    assert.equal(response.status, status, path + ': ' + JSON.stringify(body));
    return { body, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  }
  const password = 'Fictional-test-password-123';
  const register = (email, name) => request('/auth/register', { method: 'POST', data: { email, name, password }, status: 201 });
  const alice = await register('ALICE@example.test', 'Alice Demo');
  const bob = await register('bob@example.test', 'Bob Demo');
  assert.equal(alice.body.user.email, 'alice@example.test');
  assert.equal(alice.body.user.passwordHash, undefined);
  assert.match(alice.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(alice.headers.get('set-cookie'), /SameSite=Lax/i);
  assert.match(alice.headers.get('cache-control'), /no-store/);
  await request('/auth/register', { method: 'POST', data: { email: 'alice@example.test', name: 'Duplicate', password }, status: 409 });
  await request('/auth/register', { method: 'POST', data: { email: 'short@example.test', name: 'Short', password: 'short' }, status: 422 });
  for (const email of ['alice@example.test', 'missing@example.test']) await request('/auth/login', { method: 'POST', data: { email, password: 'incorrect-password-123' }, status: 401 });
  const product = await db.product.create({ data: { name: 'Test keyboard', description: 'Test catalog', category: 'Test', price: 100, stock: 5 } });
  const legacy = await db.order.create({ data: { customerName: 'Legacy', email: 'alice@example.test', address: 'Fictional old address', total: 100 } });
  const payload = { userId: bob.body.user.id, customerName: 'Forged name', email: 'bob@example.test', address: '123 Fictional Demo Street', items: [{ productId: product.id, quantity: 1 }] };
  await request('/orders', { method: 'POST', data: payload, status: 401 });
  const { body: order } = await request('/orders', { method: 'POST', cookie: alice.cookie, data: payload, status: 201 });
  assert.equal(order.userId, alice.body.user.id);
  assert.equal(order.email, 'alice@example.test');
  assert.equal(order.customerName, 'Alice Demo');
  assert.equal(order.total, 100);
  assert.equal((await db.product.findUnique({ where: { id: product.id } })).stock, 4);
  assert.equal((await request('/orders/' + order.id, { cookie: alice.cookie })).body.id, order.id);
  await request('/orders/' + order.id, { status: 401 });
  await request('/orders/' + order.id, { cookie: bob.cookie, status: 404 });
  await request('/orders/' + legacy.id, { cookie: alice.cookie, status: 404 });
  await request('/orders/invalid', { cookie: alice.cookie, status: 404 });
  await request('/orders/9999999999', { cookie: alice.cookie, status: 404 });
  assert.deepEqual((await request('/orders', { cookie: bob.cookie })).body.orders, []);
  assert.deepEqual((await request('/orders', { cookie: alice.cookie })).body.orders.map((o) => o.id), [order.id]);
  await request('/orders', { method: 'POST', cookie: alice.cookie, data: { ...payload, items: [{ productId: product.id, quantity: 5 }] }, status: 409 });
  assert.equal(await db.order.count(), 2);
  await request('/auth/logout', { method: 'POST', cookie: alice.cookie, data: {}, requestOrigin: 'https://foreign.example', status: 403 });
  assert.equal((await request('/auth/me', { cookie: alice.cookie })).body.user.id, alice.body.user.id);
  if (process.argv.includes('--browser')) {
    const { spawn } = await import('node:child_process');
    const { chromium } = await import('playwright');
    vite = spawn(process.execPath, ['../node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5179', '--strictPort'], {
      cwd: 'frontend', env: { ...process.env, VITE_API_URL: base }, stdio: 'ignore'
    });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (vite.exitCode !== null) throw Error('Isolated Vite server exited');
      try { ready = (await fetch(origin)).ok; } catch { /* Still starting. */ }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'Frontend should start');
    browser = await chromium.launch({ channel: process.env.SMOKE_BROWSER_CHANNEL || 'msedge', headless: true });
    const page = await browser.newPage();
    await page.goto(origin + '/checkout');
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Create an account instead' }).click();
    await page.getByLabel('Full name').fill('Charlie Demo');
    await page.getByLabel('Email address').fill('charlie@example.test');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await page.getByRole('heading', { name: 'Your cart is empty' }).waitFor();
    await page.getByRole('link', { name: 'Browse products' }).click();
    await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
    await page.getByRole('link', { name: 'Cart (1)', exact: true }).click();
    await page.getByRole('link', { name: 'Proceed to checkout', exact: true }).click();
    assert.equal(await page.getByLabel('Full name').inputValue(), 'Charlie Demo');
    assert.equal(await page.getByLabel('Email address').inputValue(), 'charlie@example.test');
    assert.equal(await page.getByLabel('Email address').getAttribute('readonly'), '');
    await page.getByLabel('Delivery address').fill('456 Fictional Checkout Street');
    await page.getByRole('button', { name: 'Place simulated order', exact: true }).click();
    await page.getByRole('heading', { name: 'Thank you, Charlie Demo!', exact: true }).waitFor();
    await page.getByRole('link', { name: 'View order', exact: true }).click();
    await page.getByText('456 Fictional Checkout Street', { exact: true }).waitFor();
    await page.goto(origin + '/checkout');
    await page.reload();
    await page.getByRole('button', { name: 'Sign out', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('heading', { name: 'Sign in', exact: true }).waitFor();
    await page.getByLabel('Email address').fill('alice@example.test');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Your cart is empty' }).waitFor();
    await page.getByRole('link', { name: 'My orders', exact: true }).click();
    await page.getByRole('link', { name: 'Order #' + order.id, exact: true }).click();
    await page.getByText('123 Fictional Demo Street', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('123 Fictional Demo Street', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByLabel('Email address').fill('bob@example.test');
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText('Order not found.', { exact: true }).waitFor();
    assert.equal(await page.getByText('123 Fictional Demo Street', { exact: true }).count(), 0);
    console.log('PASS: Edge browser registration, checkout sign-in redirect, authenticated checkout and order confirmation, session persistence after reload, logout, owner order details, direct route refresh, and second-customer denial.');
  }
  const login = await request('/auth/login', { method: 'POST', cookie: alice.cookie, data: { email: 'alice@example.test', password } });
  assert.notEqual(login.cookie, alice.cookie);
  await request('/auth/me', { cookie: alice.cookie, status: 401 });
  await request('/auth/logout', { method: 'POST', cookie: login.cookie, data: {}, status: 204 });
  await request('/auth/me', { cookie: login.cookie, status: 401 });
  const bobToken = bob.cookie.split('=')[1];
  assert.equal(await db.session.count({ where: { tokenHash: bobToken } }), 0);
  await db.session.update({ where: { tokenHash: tokenHash(bobToken) }, data: { expiresAt: new Date(Date.now() - 1000) } });
  await request('/auth/me', { cookie: bob.cookie, status: 401 });
  for (let i = 0; i < 21; i++) {
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: '{}' });
    if (i === 20) assert.equal(response.status, 429);
  }
  console.log('PASS: PostgreSQL migrations, account validation, salted passwords, cookie sessions, login rotation, logout revocation, expiry, guest rejection, owner access, cross-user denial, forged ownership, legacy privacy, stock checks, and CSRF origin rejection.');
} finally {
  if (browser) await browser.close();
  if (vite) { vite.kill(); await new Promise((resolve) => { if (vite.exitCode !== null) resolve(); else vite.once('exit', resolve); }); }
  if (server) await new Promise((resolve) => server.close(resolve));
  await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
  await db.$disconnect();
}
