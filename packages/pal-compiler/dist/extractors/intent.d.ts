/**
 * PAL Compiler - Stage 1: Intent Extraction
 * Transforms loose natural language into structured intent
 */
import type { ExtractedIntent, Attachment } from '@monarch/shared';
interface ExtractionContext {
    userPrompt: string;
    attachments?: Attachment[];
    previousContext?: string;
}
export declare function extractIntent(ctx: ExtractionContext): ExtractedIntent;
export {};
//# sourceMappingURL=intent.d.ts.map