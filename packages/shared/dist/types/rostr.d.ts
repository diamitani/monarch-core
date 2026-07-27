/**
 * ROSTR-specific types for phase-aware orchestration
 */
export declare const PHASE_CONFIG: {
    readonly pred: {
        readonly name: "Pre-Development";
        readonly description: "Determine IF to build before deciding HOW";
        readonly baseUrgency: 2;
        readonly agents: readonly ["researcher"];
        readonly activities: readonly ["problem definition", "competitive research", "feasibility assessment"];
        readonly criticalQuestion: "Is this worth building?";
        readonly completionCriteria: readonly ["Problem stated in one sentence", "Target user identified", "≥3 alternatives considered and rejected", "Success criteria defined (measurable)", "Known unknowns documented", "Decision: build now / later / don't build"];
    };
    readonly design: {
        readonly name: "Design";
        readonly description: "Define WHAT to build and HOW it should behave";
        readonly baseUrgency: 4;
        readonly agents: readonly ["planner", "writer"];
        readonly activities: readonly ["architecture design", "UI/UX", "data models", "API contracts"];
        readonly criticalQuestion: "What exactly are we building?";
        readonly completionCriteria: readonly ["Architecture diagram exists", "User flows documented", "Data models defined", "Interfaces specified", "Tech choices made with rationale", "Edge cases identified"];
    };
    readonly develop: {
        readonly name: "Development";
        readonly description: "Build it";
        readonly baseUrgency: 6;
        readonly agents: readonly ["planner", "writer", "organizer"];
        readonly activities: readonly ["implementation", "testing", "code review", "documentation"];
        readonly criticalQuestion: "Does it work?";
        readonly completionCriteria: readonly ["All features implemented", "Test coverage ≥ threshold", "Code review passed", "No blocking bugs", "Documentation updated"];
    };
    readonly deploy: {
        readonly name: "Deployment";
        readonly description: "Ship it safely";
        readonly baseUrgency: 8;
        readonly agents: readonly ["deployer", "organizer"];
        readonly activities: readonly ["CI/CD", "staging verification", "production deploy", "monitoring"];
        readonly criticalQuestion: "Is it safe to ship?";
        readonly completionCriteria: readonly ["Staging QA passed", "Performance benchmarks met", "Security audit passed", "Monitoring active", "Rollback procedure tested", "Production deploy verified"];
    };
    readonly debug: {
        readonly name: "Debugging";
        readonly description: "Fix what's broken";
        readonly baseUrgency: 10;
        readonly agents: readonly ["debugger", "researcher"];
        readonly activities: readonly ["bug reproduction", "root cause analysis", "fix", "regression testing"];
        readonly criticalQuestion: "What broke, why, how do we prevent it?";
        readonly completionCriteria: readonly ["Bug reproduced reliably", "Root cause identified (not just symptom)", "Fix implemented and tested", "Regression test added", "Post-mortem written (if P0/P1)"];
    };
};
export type Phase = keyof typeof PHASE_CONFIG;
export interface PriorityDimensions {
    phaseUrgency: number;
    dependencyImpact: number;
    businessImpact: number;
    resourceEfficiency: number;
}
export declare const PRIORITY_WEIGHTS: {
    readonly phaseUrgency: 0.35;
    readonly dependencyImpact: 0.3;
    readonly businessImpact: 0.25;
    readonly resourceEfficiency: 0.1;
};
export declare function calculatePriority(dimensions: PriorityDimensions): number;
export declare const PRIORITY_THRESHOLDS: {
    readonly immediate: 7;
    readonly queued: 4;
    readonly backlog: 0;
};
export declare const SOURCE_TIERS: {
    readonly tier1: {
        readonly name: "Primary & Authoritative";
        readonly credibility: 1;
        readonly sources: readonly ["arxiv", "pubmed", "jstor", "google scholar", ".gov", "standards bodies"];
        readonly usage: "Establish ground truth";
    };
    readonly tier2: {
        readonly name: "Verified & Editorial";
        readonly credibility: 0.75;
        readonly sources: readonly ["reuters", "ap", "bbc", "nyt", "wsj", "gartner", "mckinsey"];
        readonly usage: "Contextualize Tier 1, current events";
    };
    readonly tier3: {
        readonly name: "Community & UGC";
        readonly credibility: 0.4;
        readonly sources: readonly ["blogs", "social media", "forums", "stackoverflow", "reddit"];
        readonly usage: "Real-world signal, sentiment, edge cases";
    };
};
export interface ConfidenceFactors {
    sourceCount: number;
    consistency: number;
    tierDistribution: number;
    recency: number;
}
export declare function calculateConfidence(factors: ConfidenceFactors): number;
export interface AgentCapability {
    agentId: string;
    phases: Phase[];
    domains: string[];
    tools: string[];
    maxParallelTasks: number;
    specializations: string[];
}
export declare const DEFAULT_AGENT_CAPABILITIES: AgentCapability[];
//# sourceMappingURL=rostr.d.ts.map