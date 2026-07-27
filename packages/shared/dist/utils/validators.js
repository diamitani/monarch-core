/**
 * Input validation utilities
 */
import { ValidationError } from './errors.js';
/**
 * Validate chat request
 */
export function validateChatRequest(input) {
    const errors = [];
    if (!input || typeof input !== 'object') {
        return { success: false, errors: ['Invalid request body'] };
    }
    const obj = input;
    if (typeof obj.message !== 'string' || obj.message.trim().length === 0) {
        errors.push('message is required and must be a non-empty string');
    }
    if (obj.message && obj.message.length > 100000) {
        errors.push('message exceeds maximum length of 100,000 characters');
    }
    if (obj.attachments !== undefined) {
        if (!Array.isArray(obj.attachments)) {
            errors.push('attachments must be an array');
        }
        else if (obj.attachments.length > 10) {
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
            message: obj.message.trim(),
            attachments: obj.attachments,
            sessionId: obj.sessionId
        }
    };
}
/**
 * Validate PAL input
 */
export function validatePALInput(input) {
    const errors = [];
    if (!input || typeof input !== 'object') {
        return { success: false, errors: ['Invalid PAL input'] };
    }
    const obj = input;
    if (typeof obj.userPrompt !== 'string' || obj.userPrompt.trim().length === 0) {
        errors.push('userPrompt is required');
    }
    if (errors.length > 0) {
        return { success: false, errors };
    }
    return {
        success: true,
        data: {
            userPrompt: obj.userPrompt.trim(),
            attachments: obj.attachments,
            context: obj.context
        }
    };
}
/**
 * Validate extracted intent
 */
export function validateExtractedIntent(intent) {
    const errors = [];
    const validDomains = ['code', 'design', 'research', 'ops', 'sales', 'content', 'deploy', 'debug'];
    const validUrgencies = ['immediate', 'queued', 'scheduled'];
    if (!intent || typeof intent !== 'object') {
        return { success: false, errors: ['Invalid intent object'] };
    }
    const obj = intent;
    if (typeof obj.primaryIntent !== 'string' || !obj.primaryIntent) {
        errors.push('primaryIntent is required');
    }
    if (!validDomains.includes(obj.domain)) {
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
    if (!validUrgencies.includes(obj.urgency)) {
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
        data: obj
    };
}
/**
 * Validate ROSTR manifest
 */
export function validateROSTRManifest(manifest) {
    const errors = [];
    const validPhases = ['pred', 'design', 'develop', 'deploy', 'debug'];
    if (!manifest || typeof manifest !== 'object') {
        return { success: false, errors: ['Invalid manifest'] };
    }
    const obj = manifest;
    if (typeof obj.agentId !== 'string' || !obj.agentId) {
        errors.push('agentId is required');
    }
    if (!validPhases.includes(obj.phase)) {
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
        data: obj
    };
}
/**
 * Assert validation passes or throw
 */
export function assertValid(result, context) {
    if (!result.success) {
        throw new ValidationError(`${context}: ${result.errors?.join('; ')}`, result.errors);
    }
    return result.data;
}
/**
 * Sanitize string for safe display
 */
export function sanitize(str) {
    return str
        .replace(/[<>]/g, '')
        .replace(/javascript:/gi, '')
        .trim()
        .slice(0, 10000);
}
/**
 * Validate UUID format
 */
export function isValidUUID(str) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
}
/**
 * Validate email format
 */
export function isValidEmail(str) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(str);
}
//# sourceMappingURL=validators.js.map