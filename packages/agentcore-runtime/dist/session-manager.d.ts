/**
 * Session Manager - Create, resume, and manage agent sessions
 */
import type { AgentCoreSession, SessionStatus, CreateSessionParams } from '@monarch/shared';
export declare class SessionManager {
    /**
     * Create a new agent session
     */
    create(params: CreateSessionParams): Promise<AgentCoreSession>;
    /**
     * Get an existing session
     */
    get(sessionId: string): Promise<AgentCoreSession | null>;
    /**
     * Get or create session for a project + agent combination
     */
    getOrCreate(projectId: string, agentId: string, userId: string): Promise<AgentCoreSession>;
    /**
     * Update session status
     */
    updateStatus(sessionId: string, status: SessionStatus): Promise<void>;
    /**
     * List sessions for a project
     */
    listByProject(projectId: string): Promise<AgentCoreSession[]>;
    /**
     * List active sessions for a user
     */
    listActiveByUser(userId: string): Promise<AgentCoreSession[]>;
    /**
     * End a session
     */
    end(sessionId: string): Promise<void>;
    /**
     * Clean up expired sessions (call periodically)
     */
    cleanupExpired(maxIdleMs?: number): Promise<number>;
}
export declare const sessionManager: SessionManager;
//# sourceMappingURL=session-manager.d.ts.map