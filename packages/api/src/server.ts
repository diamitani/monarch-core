/**
 * Monarch Core API Server
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createLogger, API_CONFIG } from '@monarch/shared';
import { chatRouter, simpleChatRouter, projectsRouter, integrationsRouter } from './routes/index.js';
import authRouter from './routes/auth.js';
import { authMiddleware, errorHandler, notFoundHandler } from './middleware/index.js';

const logger = createLogger('server');

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later'
    }
  }
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info('Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start
    });
  });
  next();
});

// Health check (no auth)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: API_CONFIG.version,
    timestamp: new Date().toISOString()
  });
});

// API routes
const apiBase = API_CONFIG.basePath;

app.use(`${apiBase}/projects`, authMiddleware, projectsRouter);
app.use(`${apiBase}/projects`, authMiddleware, chatRouter);
app.use(`${apiBase}/integrations`, authMiddleware, integrationsRouter);
app.use(`${apiBase}/chat`, simpleChatRouter);  // Simple chat - no auth for demo
app.use(`${apiBase}/auth`, authRouter);        // Auth routes

// Status endpoint
app.get(`${apiBase}/status`, (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'Monarch Core API',
      version: API_CONFIG.version,
      environment: process.env.NODE_ENV || 'development',
      features: {
        palCompiler: true,
        bedrockAgentCore: true,
        composioIntegrations: !!process.env.COMPOSIO_API_KEY,
        streaming: true
      }
    }
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = parseInt(process.env.PORT || '8080', 10);

const server = app.listen(PORT, () => {
  logger.info(`Monarch Core API started`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    apiBase
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;
