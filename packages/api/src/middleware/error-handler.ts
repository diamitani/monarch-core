/**
 * Error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { MonarchError, createLogger, wrapError } from '@monarch/shared';

const logger = createLogger('error-handler');

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Wrap unknown errors
  const monarchError = error instanceof MonarchError
    ? error
    : wrapError(error, 'Unhandled error');

  // Log error
  logger.error('Request error', monarchError, {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  // Send response
  res.status(monarchError.statusCode).json({
    success: false,
    error: {
      code: monarchError.code,
      message: monarchError.message,
      ...(process.env.NODE_ENV === 'development' && {
        details: monarchError.details,
        stack: monarchError.stack
      })
    },
    meta: {
      requestId: req.headers['x-request-id'] as string || 'unknown',
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * 404 handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`
    }
  });
}
