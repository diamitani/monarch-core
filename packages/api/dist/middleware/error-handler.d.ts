/**
 * Error handling middleware
 */
import { Request, Response, NextFunction } from 'express';
export declare function errorHandler(error: Error, req: Request, res: Response, _next: NextFunction): void;
/**
 * 404 handler
 */
export declare function notFoundHandler(req: Request, res: Response): void;
//# sourceMappingURL=error-handler.d.ts.map