import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { orderSchema } from '../validators/schemas.js';
import { requireAuth } from '../lib/auth.js';
export function createOrdersRouter(db = prisma) {
  const router = Router();
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.use(requireAuth(db));
  const serialize = (order) => ({ ...order, total: Number(order.total), items: order.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })) });
  router.get('/', async (request, response, next) => {
    try {
      const orders = await db.order.findMany({ where: { userId: request.user.id }, include: { items: { include: { product: { select: { name: true, emoji: true } } } } }, orderBy: { createdAt: 'desc' }, take: 100 });
      response.json({ orders: orders.map(serialize) });
    } catch (error) { next(error); }
  });
  router.get('/:id', async (request, response, next) => {
    try {
      const id = Number(request.params.id);
      if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) return response.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' } });
      const order = await db.order.findFirst({ where: { id, userId: request.user.id }, include: { items: { include: { product: { select: { name: true, emoji: true } } } } } });
      if (!order) return response.status(404).json({ error: { code: 'ORDER_NOT_FOUND', message: 'Order not found.' } });
      response.json(serialize(order));
    } catch (error) { next(error); }
  });

  router.post('/', async (request, response, next) => {
    try {
      const parsed = orderSchema.safeParse({ ...request.body, customerName: request.user.name, email: request.user.email });
      if (!parsed.success) return response.status(422).json({ error: { code: 'INVALID_ORDER', message: 'Check the customer and cart information.', details: parsed.error.flatten() } });

      const productIds = [...new Set(parsed.data.items.map((item) => item.productId))];
      const products = await db.product.findMany({ where: { id: { in: productIds }, active: true } });
      if (products.length !== productIds.length) return response.status(422).json({ error: { code: 'PRODUCT_UNAVAILABLE', message: 'One or more products are unavailable.' } });

      const productMap = new Map(products.map((product) => [product.id, product]));
      const normalizedItems = parsed.data.items.map((item) => ({ ...item, product: productMap.get(item.productId) }));
      const unavailable = normalizedItems.find((item) => item.quantity > item.product.stock);
      if (unavailable) return response.status(409).json({ error: { code: 'INSUFFICIENT_STOCK', message: `Only ${unavailable.product.stock} unit(s) of ${unavailable.product.name} are available.` } });

      const total = normalizedItems.reduce((sum, item) => sum.plus(new Prisma.Decimal(item.product.price).times(item.quantity)), new Prisma.Decimal(0));
      const order = await db.$transaction(async (transaction) => {
        for (const item of normalizedItems) {
          const updated = await transaction.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } }
          });
          if (updated.count !== 1) throw Object.assign(new Error('Stock changed while placing the order.'), { status: 409, code: 'STOCK_CHANGED' });
        }
        return transaction.order.create({
          data: {
            userId: request.user.id, customerName: parsed.data.customerName, email: parsed.data.email, address: parsed.data.address, total,
            items: { create: normalizedItems.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPrice: item.product.price })) }
          },
          include: { items: { include: { product: { select: { name: true, emoji: true } } } } }
        });
      });
      response.status(201).json({ ...order, total: Number(order.total), items: order.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })) });
    } catch (error) { next(error); }
  });

  return router;
}
