/**
 * Input validation utilities
 */

import { ValidationError } from './errors.js';
import type { 
  ChatRequest, 
  PALInput, 
  ExtractedIntent, 
  ROSTRManifest,
  Domain,
  WorkflowPhase
} from '../types/index.js';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validate chat request
 */
export function validateChatRequest(input: unknown): ValidationResult<ChatRequest> {
  const errors: string[] = [];
  
  if (!input || typeof input !== 'object') {
    return { success: false, errors: ['Invalid request body'] };
  }

  const obj = input as Record<string, unknown>;

  if (typeof obj.message !== 'string' || obj.message.trim().length === 0) {
    errors.push('message is required and must be a non-empty string');
  }

  if (obj.message && (obj.message as string).length > 100000) {
    errors.push('message exceeds maximum length of 100,000 characters');
  }

  if (obj.attachments !== undefined) {
    if (!Array.isArray(obj.attachments)) {
      errors.push('attachments must be an array');
    } else if (obj.attachments.length > 10) {
      errors.push('Maximum 10 attachments allowed');
    }
  }

  if (obj.sessionId !== undefined && typeof obj.sessionId !== 'string') {
    errors.push('sessionId must be a string');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      message: (obj.message as string).trim(),
      attachments: obj.attachments as ChatRequest['attachments'],
      sessionId: obj.sessionId as string | undefined
    }
  };
}

/**
 * Validate PAL input
 */
export function validatePALInput(input: unknown): ValidationResult<PALInput> {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { success: false, errors: ['Invalid PAL input'] };
  }

  const obj = input as Record<string, unknown>;

  if (typeof obj.userPrompt !== 'string' || obj.userPrompt.trim().length === 0) {
    errors.push('userPrompt is required');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      userPrompt: (obj.userPrompt as string).trim(),
      attachments: obj.attachments as PALInput['attachments'],
      context: obj.context as PALInput['context']
    }
  };
}

/**
 * Validate extracted intent
 */
export function validateExtractedIntent(intent: unknown): ValidationResult<ExtractedIntent> {
  const errors: string[] = [];
  const validDomains: Domain[] = ['code', 'design', 'research', 'ops', 'sales', 'content', 'deploy', 'debug'];
  const validUrgencies = ['immediate', 'queued', 'scheduled'];

  if (!intent || typeof intent !== 'object') {
    return { success: false, errors: ['Invalid intent object'] };
  }

  const obj = intent as Record<string, unknown>;

  if (typeof obj.primaryIntent !== 'string' || !obj.primaryIntent) {
    errors.push('primaryIntent is required');
  }

  if (!validDomains.includes(obj.domain as Domain)) {
    errors.push(`domain must be one of: ${validDomains.join(', ')}`);
  }

  if (typeof obj.subject !== 'string') {
    errors.push('subject is required');
  }

  if (!Array.isArray(obj.constraints)) {
    errors.push('constraints must be an array');
  }

  if (typeof obj.desiredOutput !== 'string') {
    errors.push('desiredOutput is required');
  }

  if (!validUrgencies.includes(obj.urgency as string)) {
    errors.push(`urgency must be one of: ${validUrgencies.join(', ')}`);
  }

  if (typeof obj.ambiguityScore !== 'number' || obj.ambiguityScore < 0 || obj.ambiguityScore > 1) {
    errors.push('ambiguityScore must be a number between 0 and 1');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: obj as unknown as ExtractedIntent
  };
}

/**
 * Validate ROSTR manifest
 */
export function validateROSTRManifest(manifest: unknown): ValidationResult<ROSTRManifest> {
  const errors: string[] = [];
  const validPhases: WorkflowPhase[] = ['pred', 'design', 'develop', 'deploy', 'debug'];

  if (!manifest || typeof manifest !== 'object') {
    return { success: false, errors: ['Invalid manifest'] };
  }

  const obj = manifest as Record<string, unknown>;

  if (typeof obj.agentId !== 'string' || !obj.agentId) {
    errors.push('agentId is required');
  }

  if (!validPhases.includes(obj.phase as WorkflowPhase)) {
    errors.push(`phase must be one of: ${validPhases.join(', ')}`);
  }

  if (!obj.runtime || typeof obj.runtime !== 'object') {
    errors.push('runtime configuration is required');
  }

  if (!obj.instructions || typeof obj.instructions !== 'object') {
    errors.push('instructions are required');
  }

  if (!Array.isArray(obj.tools)) {
    errors.push('tools must be an array');
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: obj as unknown as ROSTRManifest
  };
}

/**
 * Assert validation passes or throw
 */
export function assertValid<T>(result: ValidationResult<T>, context: string): T {
  if (!result.success) {
    throw new ValidationError(
      `${context}: ${result.errors?.join('; ')}`,
      result.errors
    );
  }
  return result.data!;
}

/**
 * Sanitize string for safe display
 */
export function sanitize(str: string): string {
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .trim()
    .slice(0, 10000);
}

/**
 * Validate UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Validate email format
 */
export function isValidEmail(str: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}
