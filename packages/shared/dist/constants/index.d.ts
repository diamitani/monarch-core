/**
 * Shared constants
 */
export declare const MODELS: {
    readonly CLAUDE_SONNET_4: "anthropic.claude-sonnet-4-20250514-v1:0";
    readonly CLAUDE_OPUS_4: "global.anthropic.claude-opus-4-5-20251101-v1:0";
    readonly CLAUDE_HAIKU: "anthropic.claude-3-5-haiku-20241022-v1:0";
    readonly DEEPSEEK_V3: "deepseek.deepseek-v3-0324-v1:0";
};
export declare const DEFAULT_RUNTIME_CONFIG: {
    readonly modelId: "anthropic.claude-sonnet-4-20250514-v1:0";
    readonly temperature: 0.2;
    readonly maxTokens: 8192;
    readonly maxParallelTasks: 3;
    readonly timeoutSeconds: 300;
};
export declare const CONTEXT_BUDGET: {
    readonly maxTokens: 200000;
    readonly systemPromptBudget: 4000;
    readonly toolsBudget: 2000;
    readonly examplesBudget: 1000;
    readonly outputReserve: 8192;
    readonly userContextBudget: 184808;
};
export declare const SESSION_CONFIG: {
    readonly idleTimeoutSeconds: 3600;
    readonly maxSessionDurationSeconds: 86400;
    readonly maxConcurrentSessions: 10;
};
export declare const RATE_LIMITS: {
    readonly free: {
        readonly requestsPerMinute: 10;
        readonly requestsPerDay: 100;
        readonly tokensPerDay: 100000;
    };
    readonly pro: {
        readonly requestsPerMinute: 60;
        readonly requestsPerDay: 1000;
        readonly tokensPerDay: 1000000;
    };
    readonly team: {
        readonly requestsPerMinute: 120;
        readonly requestsPerDay: 5000;
        readonly tokensPerDay: 5000000;
    };
};
export declare const ARTIFACT_CONFIG: {
    readonly maxSizeBytes: number;
    readonly supportedTypes: readonly ["plan", "brief", "document", "checklist", "tracker", "code", "design"];
    readonly defaultTTLDays: 90;
};
export declare const MEMORY_CONFIG: {
    readonly maxEntriesPerProject: 1000;
    readonly embeddingDimensions: 1024;
    readonly similarityThreshold: 0.7;
    readonly defaultTTLDays: {
        readonly decision: 365;
        readonly learning: 180;
        readonly context: 30;
        readonly artifact: 90;
    };
};
export declare const API_CONFIG: {
    readonly basePath: "/api/v1";
    readonly version: "1.0.0";
    readonly defaultPageSize: 20;
    readonly maxPageSize: 100;
};
export declare const AWS_CONFIG: {
    readonly region: string;
    readonly bedrockEndpoint: `https://bedrock-runtime.${string}.amazonaws.com`;
    readonly bedrockAgentEndpoint: `https://bedrock-agent-runtime.${string}.amazonaws.com`;
};
//# sourceMappingURL=index.d.ts.map