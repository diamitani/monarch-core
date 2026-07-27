/**
 * Composio Bridge - Connect user integrations (Google, Microsoft, Slack, etc.)
 */

import type {
  ComposioIntegration,
  ComposioToolExecution,
  ComposioToolResult,
  ToolDefinition
} from '@monarch/shared';
import { ComposioError, createLogger } from '@monarch/shared';

const logger = createLogger('composio-bridge');

// Tool definitions for common Composio integrations
const INTEGRATION_TOOLS: Record<string, ToolDefinition[]> = {
  google: [
    {
      toolName: 'composio_google_drive_list',
      description: 'List files in Google Drive',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          pageSize: { type: 'number', description: 'Max results' }
        }
      },
      toolCategory: 'composio'
    },
    {
      toolName: 'composio_google_drive_read',
      description: 'Read content from a Google Drive file',
      inputSchema: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: 'File ID' }
        },
        required: ['fileId']
      },
      toolCategory: 'composio'
    },
    {
      toolName: 'composio_google_calendar_list',
      description: 'List calendar events',
      inputSchema: {
        type: 'object',
        properties: {
          timeMin: { type: 'string', description: 'Start time (ISO)' },
          timeMax: { type: 'string', description: 'End time (ISO)' },
          maxResults: { type: 'number' }
        }
      },
      toolCategory: 'composio'
    },
    {
      toolName: 'composio_google_calendar_create',
      description: 'Create a calendar event',
      inputSchema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          description: { type: 'string' },
          start: { type: 'string', description: 'Start time (ISO)' },
          end: { type: 'string', description: 'End time (ISO)' },
          attendees: { type: 'array', items: { type: 'string' } }
        },
        required: ['summary', 'start', 'end']
      },
      toolCategory: 'composio',
      requiresApproval: true
    },
    {
      toolName: 'composio_gmail_send',
      description: 'Send an email via Gmail',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
          cc: { type: 'string' },
          bcc: { type: 'string' }
        },
        required: ['to', 'subject', 'body']
      },
      toolCategory: 'composio',
      requiresApproval: true
    },
    {
      toolName: 'composio_gmail_draft',
      description: 'Create a draft email in Gmail',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' }
        },
        required: ['to', 'subject', 'body']
      },
      toolCategory: 'composio'
    }
  ],
  slack: [
    {
      toolName: 'composio_slack_send',
      description: 'Send a message to a Slack channel',
      inputSchema: {
        type: 'object',
        properties: {
          channel: { type: 'string', description: 'Channel name or ID' },
          text: { type: 'string' },
          thread_ts: { type: 'string', description: 'Thread timestamp for replies' }
        },
        required: ['channel', 'text']
      },
      toolCategory: 'composio',
      requiresApproval: true
    },
    {
      toolName: 'composio_slack_list_channels',
      description: 'List Slack channels',
      inputSchema: {
        type: 'object',
        properties: {
          types: { type: 'string', description: 'Channel types (public_channel, private_channel)' }
        }
      },
      toolCategory: 'composio'
    }
  ],
  notion: [
    {
      toolName: 'composio_notion_search',
      description: 'Search Notion pages and databases',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          filter: {
            type: 'object',
            properties: {
              property: { type: 'string' },
              value: { type: 'string' }
            }
          }
        },
        required: ['query']
      },
      toolCategory: 'composio'
    },
    {
      toolName: 'composio_notion_create_page',
      description: 'Create a new Notion page',
      inputSchema: {
        type: 'object',
        properties: {
          parentId: { type: 'string', description: 'Parent page or database ID' },
          title: { type: 'string' },
          content: { type: 'string', description: 'Markdown content' }
        },
        required: ['parentId', 'title']
      },
      toolCategory: 'composio',
      requiresApproval: true
    }
  ],
  github: [
    {
      toolName: 'composio_github_list_repos',
      description: 'List GitHub repositories',
      inputSchema: {
        type: 'object',
        properties: {
          org: { type: 'string', description: 'Organization name (optional)' },
          type: { type: 'string', description: 'Type: all, owner, member' }
        }
      },
      toolCategory: 'composio'
    },
    {
      toolName: 'composio_github_create_issue',
      description: 'Create a GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string' },
          repo: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          labels: { type: 'array', items: { type: 'string' } }
        },
        required: ['owner', 'repo', 'title']
      },
      toolCategory: 'composio',
      requiresApproval: true
    }
  ]
};

export class ComposioBridge {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.COMPOSIO_API_KEY || '';
    this.baseUrl = process.env.COMPOSIO_BASE_URL || 'https://backend.composio.dev/api/v1';
    
    if (!this.apiKey) {
      logger.warn('Composio API key not configured');
    }
  }

  /**
   * Get available tools for an integration
   */
  getToolDefinitions(integrationId: string): ToolDefinition[] {
    const provider = integrationId.split('_')[0]; // e.g., 'google_drive' -> 'google'
    return INTEGRATION_TOOLS[provider] || [];
  }

  /**
   * Get all tool definitions for user's connected integrations
   */
  getAllToolDefinitions(integrations: ComposioIntegration[]): ToolDefinition[] {
    const tools: ToolDefinition[] = [];
    const providers = new Set<string>();

    for (const integration of integrations) {
      if (integration.status === 'connected') {
        providers.add(integration.provider);
      }
    }

    for (const provider of providers) {
      tools.push(...(INTEGRATION_TOOLS[provider] || []));
    }

    return tools;
  }

  /**
   * Execute a Composio tool
   */
  async executeTool(execution: ComposioToolExecution): Promise<ComposioToolResult> {
    const startTime = Date.now();
    
    logger.info('Executing Composio tool', {
      toolName: execution.toolName,
      integrationId: execution.integrationId,
      userId: execution.userId
    });

    try {
      // In production, this would call Composio's API
      // For now, simulate the call structure
      const response = await this.callComposioAPI(
        execution.toolName,
        execution.params,
        execution.integrationId
      );

      return {
        success: true,
        data: response,
        executionTimeMs: Date.now() - startTime
      };

    } catch (error) {
      logger.error('Composio tool execution failed', error as Error, {
        toolName: execution.toolName
      });

      return {
        success: false,
        error: (error as Error).message,
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Get OAuth URL for connecting an integration
   */
  async getOAuthUrl(
    provider: string,
    userId: string,
    redirectUri: string
  ): Promise<string> {
    if (!this.apiKey) {
      throw new ComposioError('Composio API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/connectedAccounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({
          integrationId: provider,
          entityId: userId,
          redirectUri
        })
      });

      if (!response.ok) {
        throw new ComposioError(`OAuth URL request failed: ${response.statusText}`);
      }

      const data = await response.json() as { redirectUrl?: string };
      return data.redirectUrl || '';

    } catch (error) {
      logger.error('Get OAuth URL failed', error as Error, { provider, userId });
      throw new ComposioError(
        `Failed to get OAuth URL: ${(error as Error).message}`,
        { provider, userId }
      );
    }
  }

  /**
   * List user's connected integrations
   */
  async listIntegrations(userId: string): Promise<ComposioIntegration[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/connectedAccounts?entityId=${userId}`,
        {
          headers: {
            'x-api-key': this.apiKey
          }
        }
      );

      if (!response.ok) {
        throw new ComposioError(`List integrations failed: ${response.statusText}`);
      }

      const data = await response.json() as { items?: Array<{
        id: string;
        integrationId: string;
        status: string;
        createdAt: string;
        appName: string;
      }> };
      
      return (data.items || []).map(item => ({
        integrationId: item.id,
        provider: item.appName || item.integrationId,
        scopes: [],
        status: item.status === 'ACTIVE' ? 'connected' : 'expired',
        connectedAt: new Date(item.createdAt)
      }));

    } catch (error) {
      logger.error('List integrations failed', error as Error, { userId });
      return [];
    }
  }

  /**
   * Revoke an integration
   */
  async revokeIntegration(integrationId: string): Promise<void> {
    if (!this.apiKey) {
      throw new ComposioError('Composio API key not configured');
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/connectedAccounts/${integrationId}`,
        {
          method: 'DELETE',
          headers: {
            'x-api-key': this.apiKey
          }
        }
      );

      if (!response.ok) {
        throw new ComposioError(`Revoke integration failed: ${response.statusText}`);
      }

      logger.info('Integration revoked', { integrationId });

    } catch (error) {
      logger.error('Revoke integration failed', error as Error, { integrationId });
      throw new ComposioError(
        `Failed to revoke integration: ${(error as Error).message}`,
        { integrationId }
      );
    }
  }

  private async callComposioAPI(
    toolName: string,
    params: Record<string, unknown>,
    _integrationId: string
  ): Promise<unknown> {
    // In production, this would make the actual Composio API call
    // For now, return a mock response for testing
    
    if (!this.apiKey) {
      throw new ComposioError('Composio API key not configured');
    }

    // Map tool names to Composio actions
    const actionMap: Record<string, string> = {
      'composio_google_drive_list': 'GOOGLEDRIVE_LIST_FILES',
      'composio_google_drive_read': 'GOOGLEDRIVE_READ_FILE',
      'composio_google_calendar_list': 'GOOGLECALENDAR_LIST_EVENTS',
      'composio_google_calendar_create': 'GOOGLECALENDAR_CREATE_EVENT',
      'composio_gmail_send': 'GMAIL_SEND_EMAIL',
      'composio_gmail_draft': 'GMAIL_CREATE_DRAFT',
      'composio_slack_send': 'SLACK_SEND_MESSAGE',
      'composio_slack_list_channels': 'SLACK_LIST_CHANNELS',
      'composio_notion_search': 'NOTION_SEARCH',
      'composio_notion_create_page': 'NOTION_CREATE_PAGE',
      'composio_github_list_repos': 'GITHUB_LIST_REPOS',
      'composio_github_create_issue': 'GITHUB_CREATE_ISSUE'
    };

    const action = actionMap[toolName];
    if (!action) {
      throw new ComposioError(`Unknown tool: ${toolName}`);
    }

    const response = await fetch(`${this.baseUrl}/actions/${action}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify({
        input: params
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ComposioError(`Composio API error: ${errorText}`);
    }

    return response.json();
  }
}

export const composioBridge = new ComposioBridge();
