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

/**
 * Simple chat endpoint for workspace UI (no project context required)
 */
import { Router as SimpleRouter } from 'express';
export const simpleChatRouter: import('express').Router = SimpleRouter();

simpleChatRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { message, stream = false } = req.body as { message: string; stream?: boolean };
    
    if (!message || typeof message !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_REQUEST', message: 'Message is required' }
      });
      return;
    }

    logger.info('Simple chat request', { messageLength: message.length, stream });

    // Compile intent via PAL
    const palOutput = await compile({
      userPrompt: message,
      attachments: []
    });

    const { extractedIntent, manifest } = palOutput;
    
    // Build ROSTR-enhanced system prompt with phase context
    const rostrSystemPrompt = buildRostrSystemPrompt(manifest.phase, extractedIntent);

    if (stream) {
      // Streaming response via AWS Bedrock ConverseStream
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        const generator = agentCoreClient.converseStream(
          'us.anthropic.claude-sonnet-4-6',
          [{ role: 'user', content: message }],
          rostrSystemPrompt
        );

        for await (const chunk of generator) {
          if (chunk.type === 'text' && chunk.content) {
            res.write(`data: ${JSON.stringify({ type: 'text', content: chunk.content })}\n\n`);
          }
          if (chunk.type === 'done') {
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          }
        }
        res.end();
      } catch (streamError) {
        logger.error('Stream error', streamError as Error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: (streamError as Error).message })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming: Generate a plan based on the intent
      const plan = {
        id: `plan-${Date.now()}`,
        objective: extractedIntent.primaryIntent || message,
        status: 'draft' as const,
        steps: generateStepsFromIntent(extractedIntent, manifest.phase)
      };

      // Generate contextual response based on phase
      const response = generatePhaseResponse(manifest.phase, extractedIntent, plan);

      res.json({
        success: true,
        response,
        plan,
        metadata: {
          agentId: manifest.agentId,
          phase: manifest.phase,
          confidence: palOutput.confidence,
          rostrIntent: {
            primaryGoal: extractedIntent.primaryIntent,
            domain: extractedIntent.domain,
            subject: extractedIntent.subject
          }
        }
      });
    }

  } catch (error) {
    logger.error('Simple chat failed', error as Error);
    res.status(500).json({
      success: false,
      error: { code: 'CHAT_ERROR', message: (error as Error).message }
    });
  }
});

function generateStepsFromIntent(
  intent: { primaryIntent?: string; domain?: string; subject?: string },
  phase: string
) {
  // Phase-specific step templates
  const phaseSteps: Record<string, Array<{ title: string; risk: 'safe' | 'consequential' }>> = {
    'PreD': [
      { title: `Research: Investigate ${intent.subject || 'the topic'} and alternatives`, risk: 'safe' },
      { title: `Validate: Confirm problem worth solving`, risk: 'safe' },
      { title: `Define: Set success criteria and constraints`, risk: 'safe' },
      { title: `Decision: Go/No-go recommendation`, risk: 'consequential' }
    ],
    'Design': [
      { title: `Architecture: Define system structure for ${intent.subject || 'the project'}`, risk: 'safe' },
      { title: `Interfaces: Specify APIs and data models`, risk: 'safe' },
      { title: `UX: Map user flows and interactions`, risk: 'safe' },
      { title: `Review: Validate design decisions`, risk: 'consequential' }
    ],
    'Development': [
      { title: `Setup: Initialize project structure`, risk: 'safe' },
      { title: `Implement: Build ${intent.subject || 'core functionality'}`, risk: 'safe' },
      { title: `Test: Write and run tests`, risk: 'safe' },
      { title: `Deploy: Push to staging`, risk: 'consequential' }
    ],
    'Deployment': [
      { title: `Verify: Run pre-deploy checks`, risk: 'safe' },
      { title: `Stage: Deploy to staging environment`, risk: 'safe' },
      { title: `QA: Validate in staging`, risk: 'safe' },
      { title: `Ship: Deploy to production`, risk: 'consequential' }
    ],
    'Debugging': [
      { title: `Reproduce: Confirm the bug exists`, risk: 'safe' },
      { title: `Investigate: Find root cause`, risk: 'safe' },
      { title: `Fix: Implement solution`, risk: 'safe' },
      { title: `Verify: Confirm fix and add regression test`, risk: 'consequential' }
    ]
  };

  const steps = phaseSteps[phase] || phaseSteps['Development'];
  
  return steps.map((step, i) => ({
    id: String(i + 1),
    title: step.title,
    description: '',
    risk: step.risk,
    status: 'pending' as const
  }));
}

/**
 * Generate contextual response based on ROSTR phase
 */
function generatePhaseResponse(
  phase: string,
  intent: { primaryIntent?: string; domain?: string; subject?: string },
  plan: { steps: Array<{ title: string }> }
): string {
  const phaseResponses: Record<string, string> = {
    'PreD': `I've identified this as a **Pre-Development** task. Before building, let's validate whether this is worth doing.

I'll help you research "${intent.subject || 'this topic'}", identify alternatives, and define clear success criteria. This ensures we don't build something that shouldn't exist.`,

    'Design': `This is a **Design** phase task. I'll help you architect "${intent.subject || 'the solution'}" properly before any code is written.

We'll define the system structure, APIs, data models, and user flows. Good design now prevents expensive rewrites later.`,

    'Development': `This is a **Development** task. I've created a plan to build "${intent.subject || 'what you need'}".

I'll guide you through implementation with clean, tested code. Review the steps and click "Start Plan" when ready.`,

    'Deployment': `This is a **Deployment** task. I'll help you ship "${intent.subject || 'this change'}" safely.

We'll run pre-deploy checks, validate in staging, and only push to production after verification. Rollback procedures will be ready.`,

    'Debugging': `This is a **Debugging** task. I'll help you find and fix the root cause, not just the symptoms.

We'll reproduce the issue, investigate systematically, implement a fix, and add a regression test to prevent recurrence.`
  };

  return phaseResponses[phase] || phaseResponses['Development'];
}

/**
 * Build ROSTR-enhanced system prompt based on phase
 */
function buildRostrSystemPrompt(
  phase: string,
  intent: { primaryIntent?: string; domain?: string; subject?: string }
): string {
  const phaseInstructions: Record<string, string> = {
    'PreD': `You are in Pre-Development phase. Focus on:
- Validating if this is worth building
- Identifying alternatives and competitors  
- Defining success criteria
- Documenting known unknowns
Do NOT write code. Research and analyze only.`,
    'Design': `You are in Design phase. Focus on:
- Architecture and system design
- User flows and data models
- API contracts and interfaces
- Tech stack decisions with rationale`,
    'Development': `You are in Development phase. Focus on:
- Implementation with clean, tested code
- Following established patterns
- Documenting as you build
- Catching edge cases`,
    'Deployment': `You are in Deployment phase. Focus on:
- Safe deployment procedures
- Rollback plans ready
- Monitoring and alerting
- Performance verification`,
    'Debugging': `You are in Debugging phase. Focus on:
- Root cause analysis (not just symptoms)
- Reproduction steps
- Regression tests
- Post-mortem documentation`
  };

  return `You are Monarch, a phase-aware AI assistant powered by the ROSTR Framework.

Current Phase: ${phase}
${phaseInstructions[phase] || phaseInstructions['Development']}

User Intent: ${intent.primaryIntent || 'General assistance'}
Domain: ${intent.domain || 'general'}
Subject: ${intent.subject || 'unspecified'}

Guidelines:
- Be direct and actionable
- Provide concrete next steps
- Flag risks and dependencies
- Ask clarifying questions when needed`;
}
