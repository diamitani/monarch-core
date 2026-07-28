/**
 * Chat API Route - Main agent interaction endpoint
 */
import { Router } from 'express';
import { compile } from '@monarch/pal-compiler';
import { agentCoreClient, sessionManager, processAgentStream } from '@monarch/agentcore-runtime';
import { validateChatRequest, assertValid, createSSEWriter, createHeartbeat, createLogger } from '@monarch/shared';
const router = Router();
const logger = createLogger('chat-api');
// In-memory project store (would be database in production)
const projects = new Map();
/**
 * POST /api/v1/projects/:projectId/chat
 * Send a message and receive streaming agent response
 */
router.post('/:projectId/chat', async (req, res) => {
    const projectId = req.params.projectId;
    const userId = req.user?.id || 'anonymous';
    try {
        // Validate request
        const chatRequest = assertValid(validateChatRequest(req.body), 'Invalid chat request');
        logger.info('Chat request received', {
            projectId,
            userId,
            messageLength: chatRequest.message.length
        });
        // Get project context
        const project = projects.get(projectId);
        const context = project ? {
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
        const session = await sessionManager.getOrCreate(projectId, palOutput.manifest.agentId, userId);
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
                    writer.write({ event: 'artifact', data: artifact });
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
        }
        catch (error) {
            logger.error('Agent invocation failed', error, { projectId, sessionId: session.sessionId });
            writer.error(error);
        }
        finally {
            heartbeat.stop();
            writer.end();
        }
    }
    catch (error) {
        logger.error('Chat request failed', error, { projectId });
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                error: {
                    code: 'CHAT_ERROR',
                    message: error.message
                }
            });
        }
    }
});
/**
 * GET /api/v1/projects/:projectId/sessions
 * List sessions for a project
 */
router.get('/:projectId/sessions', async (req, res) => {
    const projectId = req.params.projectId;
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
    }
    catch (error) {
        logger.error('List sessions failed', error, { projectId });
        res.status(500).json({
            success: false,
            error: { code: 'LIST_SESSIONS_ERROR', message: error.message }
        });
    }
});
/**
 * POST /api/v1/projects/:projectId/sessions/:sessionId/end
 * End a session
 */
router.post('/:projectId/sessions/:sessionId/end', async (req, res) => {
    const projectId = req.params.projectId;
    const sessionId = req.params.sessionId;
    try {
        await sessionManager.end(sessionId);
        res.json({
            success: true,
            data: { sessionId, status: 'completed' }
        });
    }
    catch (error) {
        logger.error('End session failed', error, { projectId, sessionId });
        res.status(500).json({
            success: false,
            error: { code: 'END_SESSION_ERROR', message: error.message }
        });
    }
});
export default router;
/**
 * Simple chat endpoint for workspace UI (no project context required)
 */
import { Router as SimpleRouter } from 'express';
export const simpleChatRouter = SimpleRouter();
simpleChatRouter.post('/', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message || typeof message !== 'string') {
            res.status(400).json({
                success: false,
                error: { code: 'INVALID_REQUEST', message: 'Message is required' }
            });
            return;
        }
        logger.info('Simple chat request', { messageLength: message.length });
        // Compile intent
        const palOutput = await compile({
            userPrompt: message,
            attachments: []
        });
        // Generate a plan based on the intent
        const plan = {
            id: `plan-${Date.now()}`,
            objective: palOutput.extractedIntent.primaryIntent || message,
            status: 'draft',
            steps: generateStepsFromIntent(palOutput.extractedIntent)
        };
        res.json({
            success: true,
            response: `I've analyzed your request and created a plan. Review the steps and click "Start Plan" when ready.`,
            plan,
            metadata: {
                agentId: palOutput.manifest.agentId,
                phase: palOutput.manifest.phase,
                confidence: palOutput.confidence
            }
        });
    }
    catch (error) {
        logger.error('Simple chat failed', error);
        res.status(500).json({
            success: false,
            error: { code: 'CHAT_ERROR', message: error.message }
        });
    }
});
function generateStepsFromIntent(intent) {
    const steps = [
        {
            id: '1',
            title: `Research: Gather information about ${intent.subject || 'the topic'}`,
            description: '',
            risk: 'safe',
            status: 'pending'
        },
        {
            id: '2',
            title: `Analyze: Review findings and identify key considerations`,
            description: '',
            risk: 'safe',
            status: 'pending'
        },
        {
            id: '3',
            title: `Draft: Create initial outline and recommendations`,
            description: '',
            risk: 'safe',
            status: 'pending'
        },
        {
            id: '4',
            title: `Finalize: Review and prepare deliverables`,
            description: '',
            risk: 'consequential',
            status: 'pending'
        }
    ];
    return steps;
}
//# sourceMappingURL=chat.js.map