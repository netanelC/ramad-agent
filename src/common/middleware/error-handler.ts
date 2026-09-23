import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logger.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, path: req.path, method: req.method }, 'Non-operational AppError encountered');
    } else {
      logger.warn({ err, path: req.path, method: req.method }, `Operational error [${err.statusCode}]: ${err.message}`);
    }

    res.status(err.statusCode).json({
      status: 'error',
      statusCode: err.statusCode,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // Unhandled / programmer errors
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled internal server error');

  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    status: 'error',
    statusCode: 500,
    message: isProduction ? 'Internal Server Error' : (err instanceof Error ? err.message : String(err)),
  });
}
