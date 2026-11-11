import { z } from 'zod';

const draftSchema = z.object({
  answer: z.string().min(1).max(800),
  productIds: z.array(z.number().int()).max(5)
});

export const formatPeso = (value) => '\u20b1' + Number(value).toLocaleString('en-PH', { maximumFractionDigits: 2 });

/** AI selects candidates; displayed claims come only from current catalog rows.
 * Pattern checks on arbitrary provider prose cannot establish factual support.
 */
export function verifyDraft(raw, candidates) {
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return null;
  const byId = new Map(candidates.map((product) => [product.id, product]));
  const chosen = [...new Set(parsed.data.productIds)]
    .filter((id) => byId.has(id)).slice(0, 3).map((id) => byId.get(id));
  if (chosen.length === 0) return null;
  return {
    answer: 'Based on the current ShopSmart catalog: ' + chosen.map((product) =>
      product.name + ' (' + formatPeso(product.price) + ', ' + product.stock + ' in stock)'
    ).join('; ') + '.',
    recommendedProducts: chosen.map(({ id, name, price, category }) => ({ id, name, price: Number(price), category })),
    sources: chosen.map(({ id, name }) => ({ type: 'product', id, name }))
  };
}
