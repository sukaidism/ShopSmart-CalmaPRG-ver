import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { createProductsRouter } from './routes/products.js';
import { createOrdersRouter } from './routes/orders.js';
import { createAuthRouter } from './routes/auth.js';
import { prisma } from './lib/prisma.js';
import { createAssistantRouter } from './routes/assistant.js';

export function createApp({ db = prisma } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  const frontendOrigin = new URL(process.env.FRONTEND_URL || 'http://localhost:5173').origin;
  app.use(cors({ origin: frontendOrigin, credentials: true }));
  app.use((request, response, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if ((request.headers.origin && request.headers.origin !== frontendOrigin) || (!request.headers.origin && request.headers.cookie)) {
        return response.status(403).json({ error: { code: 'INVALID_ORIGIN', message: 'Request origin is not allowed.' } });
      }
      if (!request.is('application/json')) return response.status(415).json({ error: { code: 'JSON_REQUIRED', message: 'Send application/json.' } });
    }
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use((request, response, next) => { request.id = crypto.randomUUID(); response.setHeader('X-Request-ID', request.id); next(); });
  app.use(morgan(':method :url :status :response-time ms'));

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  app.use('/api/products', createProductsRouter(db));
  app.use('/api/auth', createAuthRouter(db));
  app.use('/api/orders', createOrdersRouter(db));
  app.use('/api/assistant', createAssistantRouter(db));
  app.use((_request, response) => response.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'API route could not be found.' } }));
  app.use((error, request, response, _next) => {
    console.error(`[${request.id}]`, { name: error.name, code: error.code });
    response.status(error.status || 500).json({ error: { code: error.code || 'INTERNAL_ERROR', message: error.status ? error.message : 'The server could not complete the request.', traceId: request.id } });
  });
  return app;
}
