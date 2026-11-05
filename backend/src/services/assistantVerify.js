import { z } from 'zod';

const draftSchema = z.object({
  answer: z.string().min(1).max(800),
  productIds: z.array(z.number().int()).max(5)
});

export const formatPeso = (value) => `₱${Number(value).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

const normalize = (text) => text.toLowerCase().replace(/[\s,]/g, '');

function claimsAreSupported(answer, chosen, budget) {
  const allowedPrices = new Set(chosen.map((p) => Number(p.price)));
  if (budget !== null) allowedPrices.add(budget);

  // 1. Every peso amount must be a selected product's price (or the customer's own budget).
  for (const m of answer.matchAll(/(?:₱|php\s*)\s*([\d,]+(?:\.\d{1,2})?)/gi)) {
    if (!allowedPrices.has(Number(m[1].replaceAll(',', '')))) return false;
  }

  // 2. Stock counts must match the catalog; the provider only receives in-stock items, so "out of stock" is also wrong.
  if (/out of stock|sold out|unavailable|pre-?order/i.test(answer)) return false;
  const allowedStock = new Set(chosen.map((p) => p.stock));
  for (const m of answer.matchAll(/(\d+)\s*(?:units?|pcs|pieces)?\s*(?:left|in stock|available)/gi)) {
    if (!allowedStock.has(Number(m[1]))) return false;
  }

  // 3. Spec-like tokens (144Hz, 16GB...) must appear in the selected product text.
  const haystack = normalize(chosen.map((p) => `${p.name} ${p.description}`).join(' '));
  for (const m of answer.matchAll(/\b\d+(?:\.\d+)?\s?(?:hz|gb|tb|mah|mm|w|inch|dpi|mp|fps)\b/gi)) {
    if (!haystack.includes(normalize(m[0]))) return false;
  }
  return true;
}

/** Returns a safe {answer, recommendedProducts, sources} built from catalog rows, or null if nothing usable. */
export function verifyDraft(raw, candidates, question) {
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return null;

  const byId = new Map(candidates.map((p) => [p.id, p]));
  const chosen = [...new Set(parsed.data.productIds)].filter((id) => byId.has(id)).slice(0, 3).map((id) => byId.get(id));
  if (chosen.length === 0) return null; // unknown ids or nothing picked -> rule-based fallback

  const budget = (question.replaceAll(',', '').match(/(?:₱|php|under|below|less\s+than|within|up\s+to)\s*₱?\s*(\d{2,7})/i) || [])[1];
  const supported = claimsAreSupported(parsed.data.answer, chosen, budget ? Number(budget) : null);

  const answer = supported
    ? parsed.data.answer
    : `Based on the current ShopSmart catalog: ${chosen.map((p) => `${p.name} (${formatPeso(p.price)}, ${p.stock} in stock)`).join('; ')}.`;

  return {
    answer,
    recommendedProducts: chosen.map(({ id, name, price, category }) => ({ id, name, price: Number(price), category })),
    sources: chosen.map(({ id, name }) => ({ type: 'product', id, name }))
  };
}
