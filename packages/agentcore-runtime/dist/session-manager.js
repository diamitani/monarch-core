/**
 * Session Manager - Create, resume, and manage agent sessions
 */
import { randomUUID } from 'crypto';
import { createLogger, NotFoundError } from '@monarch/shared';
const logger = createLogger('session-manager');
// In-memory store for now - would be DynamoDB in production
const sessions = new Map();
export class SessionManager {
    /**
     * Create a new agent session
     */
    async create(params) {
        const sessionId = `sess_${randomUUID().replace(/-/g, '')}`;
        const session = {
            sessionId,
            agentId: params.agentId,
            projectId: params.projectId,
            userId: params.userId,
            status: 'active',
            createdAt: new Date(),
            lastActivityAt: new Date(),
            metadata: params.metadata || {}
        };
        sessions.set(sessionId, session);
        logger.info('Session created', {
            sessionId,
            agentId: params.agentId,
            projectId: params.projectId
        });
        return session;
    }
    /**
     * Get an existing session
     */
    async get(sessionId) {
        return sessions.get(sessionId) || null;
    }
    /**
     * Get or create session for a project + agent combination
     */
    async getOrCreate(projectId, agentId, userId) {
        // Look for existing active session
        for (const session of sessions.values()) {
            if (session.projectId === projectId &&
                session.agentId === agentId &&
                session.status === 'active') {
                // Update last activity
                session.lastActivityAt = new Date();
                return session;
            }
        }
        // Create new session
        return this.create({ projectId, agentId, userId });
    }
    /**
     * Update session status
     */
    async updateStatus(sessionId, status) {
        const session = sessions.get(sessionId);
        if (!session) {
            throw new NotFoundError('Session', sessionId);
        }
        session.status = status;
        session.lastActivityAt = new Date();
        logger.info('Session status updated', { sessionId, status });
    }
    /**
     * List sessions for a project
     */
    async listByProject(projectId) {
        const result = [];
        for (const session of sessions.values()) {
            if (session.projectId === projectId) {
                result.push(session);
            }
        }
        return result.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());
    }
    /**
     * List active sessions for a user
     */
    async listActiveByUser(userId) {
        const result = [];
        for (const session of sessions.values()) {
            if (session.userId === userId && session.status === 'active') {
                result.push(session);
            }
        }
        return result;
    }
    /**
     * End a session
     */
    async end(sessionId) {
        await this.updateStatus(sessionId, 'completed');
    }
    /**
     * Clean up expired sessions (call periodically)
     */
    async cleanupExpired(maxIdleMs = 3600000) {
        const now = Date.now();
        let cleaned = 0;
        for (const [sessionId, session] of sessions.entries()) {
            if (session.status === 'active' &&
                now - session.lastActivityAt.getTime() > maxIdleMs) {
                session.status = 'expired';
                cleaned++;
                logger.info('Session expired', { sessionId });
            }
        }
        return cleaned;
    }
}
export const sessionManager = new SessionManager();
//# sourceMappingURL=session-manager.js.map