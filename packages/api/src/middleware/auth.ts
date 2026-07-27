/**
 * Authentication middleware (simplified)
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '@monarch/shared';

const logger = createLogger('auth-middleware');

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    plan: 'free' | 'pro' | 'team';
  };
}

/**
 * Simple auth middleware - in production, verify JWT/session
 */
export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // Check for API key or Bearer token
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    if (apiKey && typeof apiKey === 'string') {
      // Validate API key (simplified)
      if (apiKey.startsWith('mk_')) {
        (req as AuthenticatedRequest).user = {
          id: `user_${apiKey.slice(3, 11)}`,
          email: 'api-user@monarch.ai',
          plan: 'pro'
        };
        next();
        return;
      }
    }

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // In production: verify JWT
      // For now, extract user ID from token
      if (token.length > 10) {
        (req as AuthenticatedRequest).user = {
          id: `user_${token.slice(0, 8)}`,
          email: 'token-user@monarch.ai',
          plan: 'free'
        };
        next();
        return;
      }
    }

    // Allow anonymous access for development
    if (process.env.NODE_ENV === 'development' || process.env.ALLOW_ANONYMOUS === 'true') {
      (req as AuthenticatedRequest).user = {
        id: 'anonymous',
        email: 'anonymous@monarch.ai',
        plan: 'free'
      };
      next();
      return;
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required'
      }
    });

  } catch (error) {
    logger.error('Auth middleware error', error as Error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication failed'
      }
    });
  }
}

/**
 * Optional auth - doesn't fail if no auth provided
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  if (apiKey && typeof apiKey === 'string' && apiKey.startsWith('mk_')) {
    req.user = {
      id: `user_${apiKey.slice(3, 11)}`,
      email: 'api-user@monarch.ai',
      plan: 'pro'
    };
  } else if (authHeader?.startsWith('Bearer ') && authHeader.length > 17) {
    const token = authHeader.slice(7);
    req.user = {
      id: `user_${token.slice(0, 8)}`,
      email: 'token-user@monarch.ai',
      plan: 'free'
    };
  } else {
    req.user = {
      id: 'anonymous',
      email: 'anonymous@monarch.ai',
      plan: 'free'
    };
  }

  next();
}
