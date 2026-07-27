/**
 * PAL Compiler - Stage 3: Semantic Enhancement
 * Transforms extracted intent into precise, actionable instructions
 */
import type { ExtractedIntent } from '@monarch/shared';
interface EnhancementResult {
    enhancedPrompt: string;
    successCriteria: string[];
    escalationPolicy: 'auto-proceed' | 'require-approval' | 'human-in-loop';
}
export declare function enhanceIntent(intent: ExtractedIntent): EnhancementResult;
export {};
//# sourceMappingURL=semantic.d.ts.map