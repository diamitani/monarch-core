import { describe, it, expect } from 'vitest';
import { MODELS, DEFAULT_RUNTIME_CONFIG } from './index.js';

describe('Bedrock model IDs', () => {
  it('uses the current Claude Sonnet 4.5 model ID', () => {
    expect(MODELS.CLAUDE_SONNET_4).toBe('anthropic.claude-sonnet-4-5-20250929-v1:0');
  });

  it('no longer references the legacy-denied 20250514 Sonnet 4 model', () => {
    expect(MODELS.CLAUDE_SONNET_4).not.toContain('20250514');
  });

  it('defaults the runtime config to the Sonnet 4.5 model', () => {
    expect(DEFAULT_RUNTIME_CONFIG.modelId).toBe(MODELS.CLAUDE_SONNET_4);
  });
});
