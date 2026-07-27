/**
 * Composio Bridge - Connect user integrations (Google, Microsoft, Slack, etc.)
 */
import type { ComposioIntegration, ComposioToolExecution, ComposioToolResult, ToolDefinition } from '@monarch/shared';
export declare class ComposioBridge {
    private apiKey;
    private baseUrl;
    constructor(apiKey?: string);
    /**
     * Get available tools for an integration
     */
    getToolDefinitions(integrationId: string): ToolDefinition[];
    /**
     * Get all tool definitions for user's connected integrations
     */
    getAllToolDefinitions(integrations: ComposioIntegration[]): ToolDefinition[];
    /**
     * Execute a Composio tool
     */
    executeTool(execution: ComposioToolExecution): Promise<ComposioToolResult>;
    /**
     * Get OAuth URL for connecting an integration
     */
    getOAuthUrl(provider: string, userId: string, redirectUri: string): Promise<string>;
    /**
     * List user's connected integrations
     */
    listIntegrations(userId: string): Promise<ComposioIntegration[]>;
    /**
     * Revoke an integration
     */
    revokeIntegration(integrationId: string): Promise<void>;
    private callComposioAPI;
}
export declare const composioBridge: ComposioBridge;
//# sourceMappingURL=client.d.ts.map