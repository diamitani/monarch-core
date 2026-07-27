/**
 * PAL Compiler - Main Entry Point
 * 5-Stage Pipeline: Extract → Inject → Enhance → Compile → Route
 */

import type {
  PALInput,
  PALOutput,
  ROSTRManifest,
  ProjectContext,
  AgentRole,
  WorkflowPhase,
  ToolDefinition
} from '@monarch/shared';
import {
  PHASE_CONFIG,
  DEFAULT_AGENT_CAPABILITIES,
  calculatePriority,
  DEFAULT_RUNTIME_CONFIG
} from '@monarch/shared';
import { extractIntent } from './extractors/index.js';
import { enhanceIntent } from './enhancers/index.js';

export interface CompilerOptions {
  defaultModel?: string;
  maxContextTokens?: number;
  injectProjectContext?: boolean;
}

const DEFAULT_OPTIONS: CompilerOptions = {
  defaultModel: DEFAULT_RUNTIME_CONFIG.modelId,
  maxContextTokens: 200000,
  injectProjectContext: true
};

/**
 * Main PAL compiler - transforms user intent into agent runtime manifest
 */
export async function compile(input: PALInput, options: CompilerOptions = {}): Promise<PALOutput> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Stage 1: Extract Intent
  const extractedIntent = extractIntent({
    userPrompt: input.userPrompt,
    attachments: input.attachments
  });

  // Stage 2: Inject Context (if available)
  const contextInjected = injectContext(extractedIntent, input.context, opts);

  // Stage 3: Enhance Semantics
  const enhanced = enhanceIntent(contextInjected.intent);

  // Stage 4: Compile to Runtime Manifest
  const manifest = compileToManifest(
    extractedIntent,
    enhanced,
    input.context,
    opts
  );

  // Stage 5: Calculate confidence
  const confidence = calculateConfidence(extractedIntent, enhanced);

  return {
    manifest,
    extractedIntent,
    enhancedPrompt: enhanced.enhancedPrompt,
    confidence
  };
}

/**
 * Stage 2: Context Injection
 */
function injectContext(
  intent: ReturnType<typeof extractIntent>,
  context: ProjectContext | undefined,
  _opts: CompilerOptions
) {
  if (!context) {
    return { intent, injectedContext: null };
  }

  // Add project goals to constraints if relevant
  if (context.goals && context.goals.length > 0) {
    const relevantGoals = context.goals.filter(goal =>
      intent.subject.toLowerCase().includes(goal.toLowerCase().slice(0, 10)) ||
      goal.toLowerCase().includes(intent.subject.toLowerCase().slice(0, 10))
    );
    
    if (relevantGoals.length > 0) {
      intent.constraints.push(`Project goal: ${relevantGoals[0]}`);
    }
  }

  // Add recent decisions as context
  if (context.decisions && context.decisions.length > 0) {
    const recentDecision = context.decisions[context.decisions.length - 1];
    intent.constraints.push(`Recent decision: ${recentDecision.decision}`);
  }

  return { intent, injectedContext: context };
}

/**
 * Stage 4: Compile to Runtime Manifest
 */
function compileToManifest(
  intent: ReturnType<typeof extractIntent>,
  enhanced: ReturnType<typeof enhanceIntent>,
  context: ProjectContext | undefined,
  opts: CompilerOptions
): ROSTRManifest {
  // Determine phase based on domain
  const phase = mapDomainToPhase(intent.domain);
  
  // Select agent based on phase and domain
  const agentRole = selectAgent(phase, intent.domain);
  const agentId = `${agentRole}-agent`;
  
  // Calculate priority
  const priority = {
    phaseUrgency: PHASE_CONFIG[phase].baseUrgency + (intent.urgency === 'immediate' ? 2 : 0),
    dependencyImpact: 0, // Would come from task graph
    businessImpact: 5,   // Default medium
    resourceEfficiency: intent.ambiguityScore < 0.3 ? 8 : 5,
    composite: 0
  };
  priority.composite = calculatePriority(priority);

  // Build system prompt
  const systemPrompt = buildSystemPrompt(agentRole, phase, intent, context);
  
  // Select tools based on agent capabilities
  const tools = selectTools(agentRole, intent.domain);

  return {
    agentId,
    agentRole,
    phase,
    priority,
    
    runtime: {
      modelId: opts.defaultModel!,
      temperature: intent.domain === 'code' ? 0.1 : 0.3,
      maxTokens: 8192,
      maxParallelTasks: 1,
      timeoutSeconds: 300
    },
    
    instructions: {
      systemPrompt,
      goal: enhanced.enhancedPrompt,
      constraints: intent.constraints,
      successCriteria: enhanced.successCriteria,
      escalationPolicy: enhanced.escalationPolicy
    },
    
    tools,
    
    memory: {
      mode: context ? 'project' : 'session',
      maxContextTokens: opts.maxContextTokens!,
      longTermMemoryEnabled: true,
      contextSources: context ? [`projects/${context.projectId}`] : [],
      saveTriggers: ['decisions', 'learnings', 'artifacts']
    },
    
    streaming: {
      enabled: true,
      bidirectional: true,
      heartbeatIntervalMs: 15000
    }
  };
}

function mapDomainToPhase(domain: ReturnType<typeof extractIntent>['domain']): WorkflowPhase {
  const mapping: Record<string, WorkflowPhase> = {
    research: 'pred',
    design: 'design',
    code: 'develop',
    content: 'develop',
    ops: 'deploy',
    deploy: 'deploy',
    debug: 'debug',
    sales: 'develop'
  };
  return mapping[domain] || 'develop';
}

function selectAgent(phase: WorkflowPhase, domain: string): AgentRole {
  // Find agent with matching phase and domain
  const candidates = DEFAULT_AGENT_CAPABILITIES.filter(
    cap => cap.phases.includes(phase)
  );
  
  // Prefer agent with matching domain
  const domainMatch = candidates.find(cap =>
    cap.domains.includes(domain)
  );
  
  if (domainMatch) {
    return domainMatch.agentId as AgentRole;
  }
  
  // Fallback to first candidate
  return (candidates[0]?.agentId || 'planner') as AgentRole;
}

function buildSystemPrompt(
  role: AgentRole,
  phase: WorkflowPhase,
  intent: ReturnType<typeof extractIntent>,
  context?: ProjectContext
): string {
  const phaseConfig = PHASE_CONFIG[phase];
  
  let prompt = `You are Monarch's ${role} agent, specialized in ${phaseConfig.name}.

## Your Role
${phaseConfig.description}

## Critical Question
${phaseConfig.criticalQuestion}

## Completion Criteria
${phaseConfig.completionCriteria.map(c => `- ${c}`).join('\n')}

## Working Style
- Be direct and action-oriented
- Show your reasoning before acting
- Verify results before declaring success
- Escalate if blocked or uncertain

## Current Task
Domain: ${intent.domain}
Subject: ${intent.subject}
Urgency: ${intent.urgency}
`;

  if (context) {
    prompt += `
## Project Context
Project: ${context.projectName}
${context.goals ? `Goals: ${context.goals.join(', ')}` : ''}
`;
  }

  return prompt;
}

function selectTools(role: AgentRole, domain: string): ToolDefinition[] {
  const agentCap = DEFAULT_AGENT_CAPABILITIES.find(c => c.agentId === role);
  if (!agentCap) return [];

  // Map capability tool strings to ToolDefinitions
  const toolDefinitions: Record<string, ToolDefinition> = {
    'web_search': {
      toolName: 'web_search',
      description: 'Search the web for information',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      toolCategory: 'builtin'
    },
    'file_read': {
      toolName: 'file_read',
      description: 'Read contents of a file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      toolCategory: 'builtin'
    },
    'file_write': {
      toolName: 'file_write',
      description: 'Write content to a file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] },
      toolCategory: 'builtin',
      requiresApproval: domain === 'deploy'
    },
    'code_execute': {
      toolName: 'code_execute',
      description: 'Execute code in a sandboxed environment',
      inputSchema: { type: 'object', properties: { language: { type: 'string' }, code: { type: 'string' } }, required: ['language', 'code'] },
      toolCategory: 'builtin'
    },
    'shell_execute': {
      toolName: 'shell_execute',
      description: 'Execute shell commands',
      inputSchema: { type: 'object', properties: { command: { type: 'string' } }, required: ['command'] },
      toolCategory: 'builtin',
      requiresApproval: true
    },
    'memory_query': {
      toolName: 'memory_query',
      description: 'Query project memory for relevant context',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      toolCategory: 'builtin'
    },
    'memory_store': {
      toolName: 'memory_store',
      description: 'Store information in project memory',
      inputSchema: { type: 'object', properties: { type: { type: 'string' }, content: { type: 'string' } }, required: ['type', 'content'] },
      toolCategory: 'builtin'
    },
    'artifact_create': {
      toolName: 'artifact_create',
      description: 'Create a project artifact',
      inputSchema: { type: 'object', properties: { type: { type: 'string' }, name: { type: 'string' }, content: { type: 'string' } }, required: ['type', 'name', 'content'] },
      toolCategory: 'builtin'
    }
  };

  return agentCap.tools
    .filter(t => !t.includes('*')) // Exclude wildcard patterns for now
    .map(t => toolDefinitions[t])
    .filter(Boolean);
}

function calculateConfidence(
  intent: ReturnType<typeof extractIntent>,
  enhanced: ReturnType<typeof enhanceIntent>
): number {
  let confidence = 1.0;
  
  // Reduce for high ambiguity
  confidence -= intent.ambiguityScore * 0.5;
  
  // Reduce for human-in-loop escalation
  if (enhanced.escalationPolicy === 'human-in-loop') {
    confidence -= 0.2;
  }
  
  // Reduce for missing constraints
  if (intent.constraints.length === 0) {
    confidence -= 0.1;
  }
  
  return Math.max(0, Math.min(1, confidence));
}

export { extractIntent } from './extractors/index.js';
export { enhanceIntent } from './enhancers/index.js';
