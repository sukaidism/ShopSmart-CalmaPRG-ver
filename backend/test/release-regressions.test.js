import test from 'node:test';
import assert from 'node:assert/strict';
import { answerQuestion, parseBudget, rankProducts } from '../src/services/assistant.js';
const products = [{ id: 1, name: 'Keyboard', description: 'Mechanical keyboard', category: 'Accessories', price: 1850.50, stock: 2 }];

test('AI cannot add unsupported warranty or delivery claims to catalog sources', async () => {
  const result = await answerQuestion(products, 'keyboard', {
    draft: async () => ({ answer: 'This keyboard has a lifetime warranty and free worldwide delivery.', productIds: [1] })
  });
  assert.doesNotMatch(result.answer, /lifetime warranty|free worldwide delivery/i);
  assert.match(result.answer, /Keyboard/);
  assert.match(result.answer, /1,850.5/);
  assert.deepEqual(result.sources.map((source) => source.id), [1]);
});

test('budget preserves centavos and accepts single-digit budgets', () => {
  assert.equal(parseBudget('keyboard below PHP 1850.50'), 1850.50);
  assert.equal(parseBudget('under 5'), 5);
  assert.deepEqual(rankProducts(products, 'keyboard below PHP 1850.50').map((product) => product.id), [1]);
  assert.deepEqual(rankProducts(products, 'keyboard below PHP 1850.49'), []);
});
