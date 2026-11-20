import { draftAnswer } from './aiProvider.js';
import { verifyDraft, formatPeso } from './assistantVerify.js';

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'which', 'what', 'who', 'any', 'you', 'have', 'has', 'are', 'can',
  'show', 'find', 'give', 'need', 'want', 'looking', 'best', 'good', 'some', 'one', 'under', 'below',
  'less', 'than', 'within', 'budget', 'over', 'around', 'about', 'php', 'peso', 'pesos', 'cheap',
  'cheapest', 'recommend', 'please', 'there', 'that', 'this', 'from', 'buy'
]);

const BUDGET_PATTERN = /(?:₱|php|under|below|less\s+than|within|budget(?:\s+of)?|up\s+to|max(?:imum)?)\s*₱?\s*(\d{1,7}(?:\.\d{1,2})?)/i;

export function parseBudget(question) {
  const match = question.replaceAll(',', '').match(BUDGET_PATTERN);
  return match ? Number(match[1]) : null;
}

function topicTerms(question) {
  return question
    .toLowerCase()
    .replaceAll(',', '')
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !/^\d+$/.test(term) && !STOPWORDS.has(term))
    .map((term) => (term.endsWith('s') && term.length > 3 ? term.slice(0, -1) : term)); // keyboards -> keyboard
}

export function rankProducts(products, question) {
  const terms = topicTerms(question);
  const budget = parseBudget(question);
  return products
    .filter((p) => p.active !== false && p.stock > 0 && (budget === null || Number(p.price) <= budget))
    .map((p) => {
      const text = `${p.name} ${p.category} ${p.description}`.toLowerCase();
      return { ...p, score: terms.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0) };
    })
    // If the customer named a topic, a product must match it. Otherwise an absent category would still return products.
    .filter((p) => terms.length === 0 || p.score > 0)
    .sort((a, b) => b.score - a.score || Number(a.price) - Number(b.price));
}

const toRecommended = ({ id, name, price, category }) => ({ id, name, price: Number(price), category });
const toSource = ({ id, name }) => ({ type: 'product', id, name });

// Rule-based answer: also the fallback when the provider fails.
export function buildAssistantResponse(products, question) {
  const ranked = rankProducts(products, question).slice(0, 3);
  if (ranked.length === 0) {
    return { answer: 'I could not find an in-stock product matching that request.', recommendedProducts: [], sources: [] };
  }
  const lines = ranked.map((p) => `${p.name} (${formatPeso(p.price)}, ${p.stock} in stock)`).join('; ');
  return {
    answer: `Based on the current ShopSmart catalog, consider: ${lines}.`,
    recommendedProducts: ranked.map(toRecommended),
    sources: ranked.map(toSource)
  };
}

// Only these public fields ever leave the server.
const toProviderFacts = (p) => ({
  id: p.id, name: p.name, description: p.description, category: p.category, price: Number(p.price), stock: p.stock
});

export async function answerQuestion(products, question, { draft = draftAnswer } = {}) {
  const candidates = rankProducts(products, question).slice(0, 5);
  const fallback = buildAssistantResponse(products, question);

  // No eligible product do not call the provider at all.
  if (candidates.length === 0) return { ...fallback, mode: 'no-match' };

  try {
    const raw = await draft(question, candidates.map(toProviderFacts));
    const verified = verifyDraft(raw, candidates, question);
    if (!verified) {
      return { ...fallback, mode: 'rules', notice: 'The AI draft could not be verified, so this answer comes from catalog rules.' };
    }
    return { ...verified, mode: 'ai' };
  } catch (error) {
    console.warn('Assistant provider failed:', error.code ?? error.name); // never log the key, URL or headers
    return { ...fallback, mode: 'rules', notice: 'The AI helper is unavailable right now, so this answer comes from catalog rules.' };
  }
}

export { toRecommended, toSource };