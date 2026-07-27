/**
 * Input validation utilities
 */
import type { ChatRequest, PALInput, ExtractedIntent, ROSTRManifest } from '../types/index.js';
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: string[];
}
/**
 * Validate chat request
 */
export declare function validateChatRequest(input: unknown): ValidationResult<ChatRequest>;
/**
 * Validate PAL input
 */
export declare function validatePALInput(input: unknown): ValidationResult<PALInput>;
/**
 * Validate extracted intent
 */
export declare function validateExtractedIntent(intent: unknown): ValidationResult<ExtractedIntent>;
/**
 * Validate ROSTR manifest
 */
export declare function validateROSTRManifest(manifest: unknown): ValidationResult<ROSTRManifest>;
/**
 * Assert validation passes or throw
 */
export declare function assertValid<T>(result: ValidationResult<T>, context: string): T;
/**
 * Sanitize string for safe display
 */
export declare function sanitize(str: string): string;
/**
 * Validate UUID format
 */
export declare function isValidUUID(str: string): boolean;
/**
 * Validate email format
 */
export declare function isValidEmail(str: string): boolean;
//# sourceMappingURL=validators.d.ts.map