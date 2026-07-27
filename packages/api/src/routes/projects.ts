/**
 * Projects API Route
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { createLogger, type ProjectContext, type WorkflowPhase } from '@monarch/shared';

const router: Router = Router();
const logger = createLogger('projects-api');

// In-memory store (would be database in production)
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

const projects = new Map<string, Project>();

/**
 * POST /api/v1/projects
 * Create a new project
 */
router.post('/', async (req: Request, res: Response) => {
  const userId = (req as unknown as { user?: { id: string } }).user?.id || 'anonymous';

  try {
    const { name, description, goals } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'name is required' }
      });
      return;
    }

    const projectId = `proj_${randomUUID().replace(/-/g, '')}`;
    
    const project: Project = {
      id: projectId,
      userId,
      name,
      description,
      phase: 'pred',
      status: 'active',
      context: {
        projectId,
        projectName: name,
        goals: goals || [],
        decisions: [],
        artifacts: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    projects.set(projectId, project);

    logger.info('Project created', { projectId, name, userId });

    res.status(201).json({
      success: true,
      data: {
        id: project.id,
        name: project.name,
        description: project.description,
        phase: project.phase,
        status: project.status,
        createdAt: project.createdAt
      }
    });

  } catch (error) {
    logger.error('Create project failed', error as Error);
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_PROJECT_ERROR', message: (error as Error).message }
    });
  }
});

/**
 * GET /api/v1/projects
 * List user's projects
 */
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as unknown as { user?: { id: string } }).user?.id || 'anonymous';

  try {
    const userProjects = Array.from(projects.values())
      .filter(p => p.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    res.json({
      success: true,
      data: userProjects.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        phase: p.phase,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      }))
    });

  } catch (error) {
    logger.error('List projects failed', error as Error);
    res.status(500).json({
      success: false,
      error: { code: 'LIST_PROJECTS_ERROR', message: (error as Error).message }
    });
  }
});

/**
 * GET /api/v1/projects/:projectId
 * Get project details
 */
router.get('/:projectId', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;

  try {
    const project = projects.get(projectId);

    if (!project) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: project.id,
        name: project.name,
        description: project.description,
        phase: project.phase,
        status: project.status,
        goals: project.context.goals,
        decisions: project.context.decisions,
        artifacts: project.context.artifacts,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      }
    });

  } catch (error) {
    logger.error('Get project failed', error as Error, { projectId });
    res.status(500).json({
      success: false,
      error: { code: 'GET_PROJECT_ERROR', message: (error as Error).message }
    });
  }
});

/**
 * PATCH /api/v1/projects/:projectId
 * Update project
 */
router.patch('/:projectId', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;

  try {
    const project = projects.get(projectId);

    if (!project) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' }
      });
      return;
    }

    const { name, description, phase, status, goals } = req.body;

    if (name) project.name = name;
    if (description !== undefined) project.description = description;
    if (phase) project.phase = phase;
    if (status) project.status = status;
    if (goals) project.context.goals = goals;
    
    project.updatedAt = new Date();

    logger.info('Project updated', { projectId, updates: Object.keys(req.body) });

    res.json({
      success: true,
      data: {
        id: project.id,
        name: project.name,
        description: project.description,
        phase: project.phase,
        status: project.status,
        updatedAt: project.updatedAt
      }
    });

  } catch (error) {
    logger.error('Update project failed', error as Error, { projectId });
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_PROJECT_ERROR', message: (error as Error).message }
    });
  }
});

/**
 * DELETE /api/v1/projects/:projectId
 * Delete (archive) project
 */
router.delete('/:projectId', async (req: Request, res: Response) => {
  const projectId = req.params.projectId as string;

  try {
    const project = projects.get(projectId);

    if (!project) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' }
      });
      return;
    }

    // Soft delete - just archive
    project.status = 'archived';
    project.updatedAt = new Date();

    logger.info('Project archived', { projectId });

    res.json({
      success: true,
      data: { id: projectId, status: 'archived' }
    });

  } catch (error) {
    logger.error('Delete project failed', error as Error, { projectId });
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_PROJECT_ERROR', message: (error as Error).message }
    });
  }
});

export default router;
export { projects }; // Export for chat route
