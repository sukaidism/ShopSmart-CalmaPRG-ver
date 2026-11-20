import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssistantResponse, parseBudget, rankProducts } from '../src/services/assistant.js';
import { answerQuestion } from '../src/services/assistant.js';

const products = [
  { id: 1, name: 'Keyboard', category: 'Accessories', description: 'Mechanical keyboard', price: 1800, stock: 2 },
  { id: 2, name: 'Mouse', category: 'Accessories', description: 'Wireless mouse', price: 600, stock: 3 }
];

const catalog = [
  ...products,
  { id: 3, name: 'Compact Mechanical Keyboard', category: 'Accessories', description: 'Compact mechanical keyboard', price: '1850.00', stock: 5, active: true },
  { id: 4, name: 'Gaming Keyboard', category: 'Accessories', description: 'RGB keyboard', price: 1500, stock: 0, active: true }
];

test('parseBudget extracts a peso budget', () => assert.equal(parseBudget('below ₱2,000'), 2000));
test('rankProducts respects the budget', () => assert.deepEqual(rankProducts(products, 'mouse below 700').map((p) => p.id), [2]));
test('assistant response contains traceable sources', () => assert.equal(buildAssistantResponse(products, 'keyboard').sources[0].id, 1));

test('no match does not call the provider', async () => {
  let called = false;
  const r = await answerQuestion(catalog, 'Do you sell a drone?', { draft: async () => { called = true; } });
  assert.equal(called, false);
  assert.deepEqual(r.recommendedProducts, []);
  assert.deepEqual(r.sources, []);
});

test('out-of-stock products are never recommended', async () => {
  const r = await answerQuestion(catalog, 'keyboard below 2000', { draft: async () => ({ answer: 'x', productIds: [4] }) });
  assert.ok(!r.recommendedProducts.some((p) => p.id === 4));
});

test('invented ids are dropped and rules fallback is used', async () => {
  const r = await answerQuestion(catalog, 'keyboard below 2000', { draft: async () => ({ answer: 'Buy this', productIds: [999] }) });
  assert.equal(r.mode, 'rules');
  assert.ok(r.sources.every((s) => [1, 3].includes(s.id)));
});

test('wrong price claim is replaced with verified facts', async () => {
  const r = await answerQuestion(catalog, 'keyboard below 2000', { draft: async () => ({ answer: 'Only ₱999!', productIds: [3] }) });
  assert.ok(!r.answer.includes('999'));
  assert.equal(r.recommendedProducts[0].price, 1850);
});

test('supported draft is accepted', async () => {
  const r = await answerQuestion(catalog, 'keyboard below 2000', { draft: async () => ({ answer: 'The Compact Mechanical Keyboard costs ₱1,850.', productIds: [3] }) });
  assert.equal(r.mode, 'ai');
});

test('provider failure falls back to rules', async () => {
  const r = await answerQuestion(catalog, 'keyboard below 2000', { draft: async () => { throw new Error('boom'); } });
  assert.equal(r.mode, 'rules');
  assert.ok(r.notice);
  assert.ok(r.recommendedProducts.length > 0);
});