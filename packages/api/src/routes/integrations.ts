/**
 * Integrations API Route - Composio OAuth and tool management
 */

import { Router, Request, Response } from 'express';
import { composioBridge } from '@monarch/composio-bridge';
import { createLogger } from '@monarch/shared';

const router: Router = Router();
const logger = createLogger('integrations-api');

/**
 * GET /api/v1/integrations
 * List user's connected integrations
 */
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as unknown as { user?: { id: string } }).user?.id || 'anonymous';

  try {
    const integrations = await composioBridge.listIntegrations(userId);

    res.json({
      success: true,
      data: integrations.map(i => ({
        id: i.integrationId,
        provider: i.provider,
        status: i.status,
        connectedAt: i.connectedAt,
        expiresAt: i.expiresAt
      }))
    });

  } catch (error) {
    logger.error('List integrations failed', error as Error);
    res.status(500).json({
      success: false,
      error: { code: 'LIST_INTEGRATIONS_ERROR', message: (error as Error).message }
    });
  }
});

/**
 * POST /api/v1/integrations/connect
 * Get OAuth URL to connect an integration
 */
router.post('/connect', async (req: Request, res: Response) => {
  const userId = (req as unknown as { user?: { id: string } }).user?.id || 'anonymous';

  try {
    const { provider } = req.body;

    if (!provider || typeof provider !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'provider is required' }
      });
      return;
    }

    const supportedProviders = ['google', 'slack', 'notion', 'github', 'microsoft'];
    if (!supportedProviders.includes(provider)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_PROVIDER',
          message: `Supported providers: ${supportedProviders.join(', ')}`
        }
      });
      return;
    }

    const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/v1/integrations/callback`;
    const oauthUrl = await composioBridge.getOAuthUrl(provider, userId, redirectUri);

    logger.info('OAuth URL generated', { provider, userId });

    res.json({
      success: true,
      data: { oauthUrl, provider }
    });

  } catch (error) {
    logger.error('Connect integration failed', error as Error);
    res.status(500).json({
      success: false,
      error: { code: 'CONNECT_ERROR', message: (error as Error).message }
    });
  }
});

/**
 * GET /api/v1/integrations/callback
 * OAuth callback handler
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_CODE', message: 'OAuth code is required' }
      });
      return;
    }

    logger.info('OAuth callback received', { hasState: !!state });

    // In production, exchange code for token via Composio
    // For now, redirect to success page
    res.redirect('/integrations?status=connected');

  } catch (error) {
    logger.error('OAuth callback failed', error as Error);
    res.redirect('/integrations?status=error');
  }
});

/**
 * DELETE /api/v1/integrations/:integrationId
 * Revoke an integration
 */
router.delete('/:integrationId', async (req: Request, res: Response) => {
  const integrationId = req.params.integrationId as string;

  try {
    await composioBridge.revokeIntegration(integrationId);

    logger.info('Integration revoked', { integrationId });

    res.json({
      success: true,
      data: { integrationId, status: 'revoked' }
    });

  } catch (error) {
    logger.error('Revoke integration failed', error as Error, { integrationId });
    res.status(500).json({
      success: false,
      error: { code: 'REVOKE_ERROR', message: (error as Error).message }
    });
  }
});

/**
 * GET /api/v1/integrations/:integrationId/tools
 * List available tools for an integration
 */
router.get('/:integrationId/tools', async (req: Request, res: Response) => {
  const integrationId = req.params.integrationId as string;

  try {
    const tools = composioBridge.getToolDefinitions(integrationId);

    res.json({
      success: true,
      data: tools.map(t => ({
        name: t.toolName,
        description: t.description,
        requiresApproval: t.requiresApproval || false
      }))
    });

  } catch (error) {
    logger.error('List tools failed', error as Error, { integrationId });
    res.status(500).json({
      success: false,
      error: { code: 'LIST_TOOLS_ERROR', message: (error as Error).message }
    });
  }
});

export default router;
