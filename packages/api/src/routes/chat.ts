/**
 * Chat API Route - Main agent interaction endpoint
 */

import { Router, Request, Response } from 'express';
import { compile } from '@monarch/pal-compiler';
import { agentCoreClient, sessionManager, processAgentStream } from '@monarch/agentcore-runtime';
import { composioBridge } from '@monarch/composio-bridge';
import {
  validateChatRequest,
  assertValid,
  createSSEWriter,
  createHeartbeat,
  createLogger,
  type ChatRequest,
  type ProjectContext
} from '@monarch/shared';

const router: Router = Router();
const logger = createLogger('chat-api');

// In-memory project store (would be database in production)
const projects = new Map<string, {
  id: string;
  name: string;
  userId: string;
  context: ProjectContext;
}>();

/**
 * POST /api/v1/projects/:projectId/chat
 * Send a message and receive streaming agent response
 */
router.post('/:projectId/chat', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const userId = (req as unknown as { user?: { id: string } }).user?.id || 'anonymous';

  try {
    // Validate request
    const chatRequest = assertValid(
      validateChatRequest(req.body),
      'Invalid chat request'
    );

    logger.info('Chat request received', {
      projectId,
      userId,
      messageLength: chatRequest.message.length
    });

    // Get project context
    const project = projects.get(projectId);
    const context: ProjectContext | undefined = project ? {
      projectId,
      projectName: project.name,
      goals: project.context.goals,
      decisions: project.context.decisions,
      artifacts: project.context.artifacts
    } : undefined;

    // Compile intent to manifest
    const palOutput = await compile({
      userPrompt: chatRequest.message,
      attachments: chatRequest.attachments,
      context
    });

    logger.info('PAL compilation complete', {
      projectId,
      agentId: palOutput.manifest.agentId,
      phase: palOutput.manifest.phase,
      confidence: palOutput.confidence
    });

    // Get or create session
    const session = await sessionManager.getOrCreate(
      projectId,
      palOutput.manifest.agentId,
      userId
    );

    // Get Composio tools if user has integrations
    // const integrations = await composioBridge.listIntegrations(userId);
    // const composioTools = composioBridge.getAllToolDefinitions(integrations);
    // Could add to manifest.tools here

    // Setup SSE streaming
    const writer = createSSEWriter(res);
    const heartbeat = createHeartbeat(writer, 15000);
    heartbeat.start();

    // Send initial metadata
    writer.write({
      event: 'message',
      data: {
        type: 'metadata',
        sessionId: session.sessionId,
        agentId: palOutput.manifest.agentId,
        phase: palOutput.manifest.phase,
        confidence: palOutput.confidence
      }
    });

    try {
      // Invoke agent with streaming
      const stream = agentCoreClient.invokeAgent({
        agentId: palOutput.manifest.agentId,
        sessionId: session.sessionId,
        inputText: palOutput.manifest.instructions.goal,
        enableTrace: true,
        sessionState: {
          sessionAttributes: {
            projectId,
            userId,
            phase: palOutput.manifest.phase
          },
          promptSessionAttributes: {
            systemPrompt: palOutput.manifest.instructions.systemPrompt
          }
        }
      });

      // Process stream and send events
      const fullResponse = await processAgentStream(stream, {
        onText: (text) => {
          writer.write({ event: 'message', data: { type: 'text', content: text } });
        },
        onToolUse: (toolName, input) => {
          writer.write({
            event: 'tool',
            data: { status: 'start', name: toolName, input }
          });
        },
        onToolResult: (toolName, result) => {
          writer.write({
            event: 'tool',
            data: { status: 'end', name: toolName, result }
          });
        },
        onArtifact: (artifact) => {
          writer.write({ event: 'artifact', data: artifact as Record<string, unknown> });
        },
        onTrace: (trace) => {
          // Only send traces in debug mode
          if (process.env.DEBUG_TRACES === 'true') {
            writer.write({ event: 'message', data: { type: 'trace', trace } });
          }
        },
        onError: (error) => {
          writer.write({ event: 'error', data: { message: error.message } });
        }
      });

      logger.info('Agent response complete', {
        projectId,
        sessionId: session.sessionId,
        responseLength: fullResponse.length
      });

    } catch (error) {
      logger.error('Agent invocation failed', error as Error, { projectId, sessionId: session.sessionId });
      writer.error(error as Error);
    } finally {
      heartbeat.stop();
      writer.end();
    }

  } catch (error) {
    logger.error('Chat request failed', error as Error, { projectId });
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: {
          code: 'CHAT_ERROR',
          message: (error as Error).message
        }
      });
    }
  }
});

/**
 * GET /api/v1/projects/:projectId/sessions
 * List sessions for a project
 */
router.get('/:projectId/sessions', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;

  try {
    const sessions = await sessionManager.listByProject(projectId);
    
    res.json({
      success: true,
      data: sessions.map(s => ({
        sessionId: s.sessionId,
        agentId: s.agentId,
        status: s.status,
        createdAt: s.createdAt,
        lastActivityAt: s.lastActivityAt
      }))
    });

  } catch (error) {
    logger.error('List sessions failed', error as Error, { projectId });
    res.status(500).json({
      success: false,
      error: { code: 'LIST_SESSIONS_ERROR', message: (error as Error).message }
    });
  }
});

/**
 * POST /api/v1/projects/:projectId/sessions/:sessionId/end
 * End a session
 */
router.post('/:projectId/sessions/:sessionId/end', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;
  const sessionId = req.params.sessionId as string;

  try {
    await sessionManager.end(sessionId);
    
    res.json({
      success: true,
      data: { sessionId, status: 'completed' }
    });

  } catch (error) {
    logger.error('End session failed', error as Error, { projectId, sessionId });
    res.status(500).json({
      success: false,
      error: { code: 'END_SESSION_ERROR', message: (error as Error).message }
    });
  }
});

export default router;
