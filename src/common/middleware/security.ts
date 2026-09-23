import helmet from 'helmet';
import type { RequestHandler } from 'express';

export const securityMiddleware: RequestHandler = helmet({
  contentSecurityPolicy: false, // API server does not serve HTML views
  crossOriginEmbedderPolicy: false,
});
