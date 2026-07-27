/**
 * Projects API Route
 */
import { Router } from 'express';
import { type ProjectContext, type WorkflowPhase } from '@monarch/shared';
declare const router: Router;
interface Project {
    id: string;
    userId: string;
    name: string;
    description?: string;
    phase: WorkflowPhase;
    status: 'active' | 'paused' | 'completed' | 'archived';
    context: ProjectContext;
    createdAt: Date;
    updatedAt: Date;
}
declare const projects: Map<string, Project>;
export default router;
export { projects };
//# sourceMappingURL=projects.d.ts.map