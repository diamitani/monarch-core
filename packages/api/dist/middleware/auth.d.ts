/**
 * Authentication middleware (simplified)
 */
import { Request, Response, NextFunction } from 'express';
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
export declare function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void;
/**
 * Optional auth - doesn't fail if no auth provided
 */
export declare function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void;
export {};
//# sourceMappingURL=auth.d.ts.map