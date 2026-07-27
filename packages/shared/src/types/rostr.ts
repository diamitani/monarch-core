/**
 * ROSTR-specific types for phase-aware orchestration
 */

// 5D Phase Taxonomy
export const PHASE_CONFIG = {
  pred: {
    name: 'Pre-Development',
    description: 'Determine IF to build before deciding HOW',
    baseUrgency: 2,
    agents: ['researcher'],
    activities: ['problem definition', 'competitive research', 'feasibility assessment'],
    criticalQuestion: 'Is this worth building?',
    completionCriteria: [
      'Problem stated in one sentence',
      'Target user identified',
      '≥3 alternatives considered and rejected',
      'Success criteria defined (measurable)',
      'Known unknowns documented',
      'Decision: build now / later / don\'t build'
    ]
  },
  design: {
    name: 'Design',
    description: 'Define WHAT to build and HOW it should behave',
    baseUrgency: 4,
    agents: ['planner', 'writer'],
    activities: ['architecture design', 'UI/UX', 'data models', 'API contracts'],
    criticalQuestion: 'What exactly are we building?',
    completionCriteria: [
      'Architecture diagram exists',
      'User flows documented',
      'Data models defined',
      'Interfaces specified',
      'Tech choices made with rationale',
      'Edge cases identified'
    ]
  },
  develop: {
    name: 'Development',
    description: 'Build it',
    baseUrgency: 6,
    agents: ['planner', 'writer', 'organizer'],
    activities: ['implementation', 'testing', 'code review', 'documentation'],
    criticalQuestion: 'Does it work?',
    completionCriteria: [
      'All features implemented',
      'Test coverage ≥ threshold',
      'Code review passed',
      'No blocking bugs',
      'Documentation updated'
    ]
  },
  deploy: {
    name: 'Deployment',
    description: 'Ship it safely',
    baseUrgency: 8,
    agents: ['deployer', 'organizer'],
    activities: ['CI/CD', 'staging verification', 'production deploy', 'monitoring'],
    criticalQuestion: 'Is it safe to ship?',
    completionCriteria: [
      'Staging QA passed',
      'Performance benchmarks met',
      'Security audit passed',
      'Monitoring active',
      'Rollback procedure tested',
      'Production deploy verified'
    ]
  },
  debug: {
    name: 'Debugging',
    description: 'Fix what\'s broken',
    baseUrgency: 10,
    agents: ['debugger', 'researcher'],
    activities: ['bug reproduction', 'root cause analysis', 'fix', 'regression testing'],
    criticalQuestion: 'What broke, why, how do we prevent it?',
    completionCriteria: [
      'Bug reproduced reliably',
      'Root cause identified (not just symptom)',
      'Fix implemented and tested',
      'Regression test added',
      'Post-mortem written (if P0/P1)'
    ]
  }
} as const;

export type Phase = keyof typeof PHASE_CONFIG;

// 4D Priority Scoring
export interface PriorityDimensions {
  phaseUrgency: number;       // Base from phase + modifiers
  dependencyImpact: number;   // How many tasks blocked
  businessImpact: number;     // Revenue, UX, productivity
  resourceEfficiency: number; // Time to complete vs complexity
}

export const PRIORITY_WEIGHTS = {
  phaseUrgency: 0.35,
  dependencyImpact: 0.30,
  businessImpact: 0.25,
  resourceEfficiency: 0.10
} as const;

export function calculatePriority(dimensions: PriorityDimensions): number {
  return (
    dimensions.phaseUrgency * PRIORITY_WEIGHTS.phaseUrgency +
    dimensions.dependencyImpact * PRIORITY_WEIGHTS.dependencyImpact +
    dimensions.businessImpact * PRIORITY_WEIGHTS.businessImpact +
    dimensions.resourceEfficiency * PRIORITY_WEIGHTS.resourceEfficiency
  );
}

export const PRIORITY_THRESHOLDS = {
  immediate: 7.0,  // Allocate now
  queued: 4.0,     // Next in line
  backlog: 0.0     // When capacity allows
} as const;

// RAG DAL Source Tiers
export const SOURCE_TIERS = {
  tier1: {
    name: 'Primary & Authoritative',
    credibility: 1.0,
    sources: ['arxiv', 'pubmed', 'jstor', 'google scholar', '.gov', 'standards bodies'],
    usage: 'Establish ground truth'
  },
  tier2: {
    name: 'Verified & Editorial',
    credibility: 0.75,
    sources: ['reuters', 'ap', 'bbc', 'nyt', 'wsj', 'gartner', 'mckinsey'],
    usage: 'Contextualize Tier 1, current events'
  },
  tier3: {
    name: 'Community & UGC',
    credibility: 0.40,
    sources: ['blogs', 'social media', 'forums', 'stackoverflow', 'reddit'],
    usage: 'Real-world signal, sentiment, edge cases'
  }
} as const;

// Confidence Scoring
export interface ConfidenceFactors {
  sourceCount: number;
  consistency: number;      // 0-1: how much sources agree
  tierDistribution: number; // 0-1: weighted by tier credibility
  recency: number;          // 0-1: how recent the information
}

export function calculateConfidence(factors: ConfidenceFactors): number {
  return (
    factors.sourceCount * 0.35 +
    factors.consistency * 0.30 +
    factors.tierDistribution * 0.25 +
    factors.recency * 0.10
  );
}

// Agent Routing Rules
export interface AgentCapability {
  agentId: string;
  phases: Phase[];
  domains: string[];
  tools: string[];
  maxParallelTasks: number;
  specializations: string[];
}

export const DEFAULT_AGENT_CAPABILITIES: AgentCapability[] = [
  {
    agentId: 'researcher',
    phases: ['pred', 'debug'],
    domains: ['research', 'debug'],
    tools: ['web_search', 'file_read', 'memory_query'],
    maxParallelTasks: 3,
    specializations: ['information gathering', 'competitive analysis', 'root cause analysis']
  },
  {
    agentId: 'planner',
    phases: ['design', 'develop'],
    domains: ['design', 'ops'],
    tools: ['file_write', 'artifact_create', 'memory_store'],
    maxParallelTasks: 2,
    specializations: ['architecture', 'timelines', 'action plans']
  },
  {
    agentId: 'writer',
    phases: ['design', 'develop'],
    domains: ['content', 'code'],
    tools: ['file_write', 'code_execute', 'artifact_create'],
    maxParallelTasks: 3,
    specializations: ['documentation', 'content creation', 'code generation']
  },
  {
    agentId: 'organizer',
    phases: ['develop', 'deploy'],
    domains: ['ops', 'sales'],
    tools: ['file_write', 'composio_*', 'artifact_create'],
    maxParallelTasks: 2,
    specializations: ['data structuring', 'trackers', 'integrations']
  },
  {
    agentId: 'deployer',
    phases: ['deploy'],
    domains: ['deploy', 'ops'],
    tools: ['shell_execute', 'file_write', 'composio_*'],
    maxParallelTasks: 1,
    specializations: ['CI/CD', 'infrastructure', 'monitoring']
  },
  {
    agentId: 'debugger',
    phases: ['debug'],
    domains: ['debug', 'code'],
    tools: ['file_read', 'code_execute', 'shell_execute', 'memory_query'],
    maxParallelTasks: 2,
    specializations: ['reproduction', 'root cause analysis', 'fix verification']
  }
];
