/**
 * PAL Compiler - Main Entry Point
 * 5-Stage Pipeline: Extract → Inject → Enhance → Compile → Route
 */
import type { PALInput, PALOutput } from '@monarch/shared';
export interface CompilerOptions {
    defaultModel?: string;
    maxContextTokens?: number;
    injectProjectContext?: boolean;
}
/**
 * Main PAL compiler - transforms user intent into agent runtime manifest
 */
export declare function compile(input: PALInput, options?: CompilerOptions): Promise<PALOutput>;
export { extractIntent } from './extractors/index.js';
export { enhanceIntent } from './enhancers/index.js';
//# sourceMappingURL=compiler.d.ts.map