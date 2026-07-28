/**
 * Auth Routes — Signup, Login, Onboarding
 * PAL-driven onboarding: classifies user intent → routes to phase → guides setup
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { compile } from '@monarch/pal-compiler';
import { createLogger } from '@monarch/shared';

const router: Router = Router();
const logger = createLogger('auth-api');

// ─────────────────────────────────────────────────────────────
// In-memory user store (replace with DB in production)
// ─────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  onboardingPhase: 'signup' | 'classify' | 'setup' | 'complete';
  onboardingData: {
    intent?: { primaryIntent?: string; domain?: string; subject?: string };
    phase?: string;
    goals?: string[];
    preferences?: Record<string, string>;
  };
  createdAt: Date;
}

const users = new Map<string, User>();
const emailIndex = new Map<string, string>(); // email → userId
const tokens = new Map<string, { userId: string; expires: Date }>();

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'monarch-salt').digest('hex');
}

function generateToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { userId, expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }); // 30 days
  return token;
}

function authUser(req: Request): User | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const entry = tokens.get(token);
  if (!entry || entry.expires < new Date()) return null;
  return users.get(entry.userId) || null;
}

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/signup
// ─────────────────────────────────────────────────────────────

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, name, password } = req.body as { email?: string; name?: string; password?: string };

    if (!email || !name || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email, name, and password are required' }
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters' }
      });
      return;
    }

    if (emailIndex.has(email.toLowerCase())) {
      res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' }
      });
      return;
    }

    const id = `user_${crypto.randomBytes(12).toString('hex')}`;
    const user: User = {
      id,
      email: email.toLowerCase(),
      name,
      passwordHash: hashPassword(password),
      onboardingPhase: 'signup',
      onboardingData: {},
      createdAt: new Date()
    };

    users.set(id, user);
    emailIndex.set(email.toLowerCase(), id);

    const token = generateToken(id);

    logger.info('User signed up', { userId: id, email: email.toLowerCase() });

    res.status(201).json({
      success: true,
      data: {
        user: { id, email: user.email, name: user.name, onboardingPhase: 'classify' },
        token
      },
      nextStep: 'classify' // Redirect to onboarding classification
    });

  } catch (error) {
    logger.error('Signup failed', error as Error);
    res.status(500).json({
      success: false,
      error: { code: 'SIGNUP_ERROR', message: (error as Error).message }
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
// ─────────────────────────────────────────────────────────────

router.post('/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' }
      });
      return;
    }

    const userId = emailIndex.get(email.toLowerCase());
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
      return;
    }

    const user = users.get(userId)!;
    if (user.passwordHash !== hashPassword(password)) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
      return;
    }

    const token = generateToken(userId);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          onboardingPhase: user.onboardingPhase
        },
        token
      },
      nextStep: user.onboardingPhase === 'complete' ? 'dashboard' : 'onboarding'
    });

  } catch (error) {
    logger.error('Login failed', error as Error);
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_ERROR', message: (error as Error).message }
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/onboarding/classify
// PAL-driven intent classification for new users
// ─────────────────────────────────────────────────────────────

router.post('/onboarding/classify', async (req: Request, res: Response) => {
  const user = authUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  try {
    const { goal } = req.body as { goal?: string };

    if (!goal || typeof goal !== 'string') {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Please describe what you want to accomplish' }
      });
      return;
    }

    // PAL compilation — classify user intent into phase and domain
    const palOutput = await compile({
      userPrompt: goal,
      attachments: []
    });

    const intent = palOutput.extractedIntent;
    const phase = palOutput.manifest.phase;

    // Update user onboarding data
    user.onboardingData = {
      intent: {
        primaryIntent: intent.primaryIntent,
        domain: intent.domain,
        subject: intent.subject
      },
      phase,
      goals: [goal]
    };
    user.onboardingPhase = 'classify';
    users.set(user.id, user);

    logger.info('User classified', {
      userId: user.id,
      phase,
      intent: intent.primaryIntent
    });

    // Return classification + guided next questions
    const questions = getPhaseQuestions(phase, intent);

    res.json({
      success: true,
      data: {
        phase,
        phaseLabel: getPhaseLabel(phase),
        phaseDescription: getPhaseDescription(phase),
        intent: {
          primaryGoal: intent.primaryIntent,
          domain: intent.domain,
          subject: intent.subject
        },
        confidence: palOutput.confidence,
        questions
      }
    });

  } catch (error) {
    logger.error('Onboarding classify failed', error as Error);
    res.status(500).json({
      success: false,
      error: { code: 'CLASSIFY_ERROR', message: (error as Error).message }
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/onboarding/complete
// Finalize onboarding — compile preferences into profile
// ─────────────────────────────────────────────────────────────

router.post('/onboarding/complete', (req: Request, res: Response) => {
  const user = authUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  try {
    const { preferences } = req.body as { preferences?: Record<string, string> };

    user.onboardingData.preferences = preferences || {};
    user.onboardingPhase = 'complete';
    users.set(user.id, user);

    // Provision workspace
    const workspace = provisionWorkspace(user);

    logger.info('Onboarding complete', { userId: user.id, workspaceId: workspace.id });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          onboardingPhase: 'complete'
        },
        workspace,
        dashboard: generateDashboard(user)
      }
    });

  } catch (error) {
    logger.error('Onboarding complete failed', error as Error);
    res.status(500).json({
      success: false,
      error: { code: 'ONBOARDING_ERROR', message: (error as Error).message }
    });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/auth/me
// ─────────────────────────────────────────────────────────────

router.get('/me', (req: Request, res: Response) => {
  const user = authUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        onboardingPhase: user.onboardingPhase
      },
      dashboard: user.onboardingPhase === 'complete' ? generateDashboard(user) : null
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Workspace store
// ─────────────────────────────────────────────────────────────

interface Workspace {
  id: string;
  userId: string;
  name: string;
  projects: Array<{ id: string; name: string; status: string; createdAt: Date }>;
  sessions: Array<{ id: string; agentId: string; createdAt: Date }>;
  createdAt: Date;
}

const workspaces = new Map<string, Workspace>();
const userWorkspaces = new Map<string, string>(); // userId → workspaceId

function provisionWorkspace(user: User): Workspace {
  const existingId = userWorkspaces.get(user.id);
  if (existingId) return workspaces.get(existingId)!;

  const wsId = `ws_${crypto.randomBytes(8).toString('hex')}`;
  const workspace: Workspace = {
    id: wsId,
    userId: user.id,
    name: `${user.name}'s Workspace`,
    projects: [{
      id: `proj_${crypto.randomBytes(6).toString('hex')}`,
      name: 'Default Project',
      status: 'active',
      createdAt: new Date(),
    }],
    sessions: [],
    createdAt: new Date(),
  };

  workspaces.set(wsId, workspace);
  userWorkspaces.set(user.id, wsId);
  return workspace;
}

function getWorkspace(userId: string): Workspace | null {
  const wsId = userWorkspaces.get(userId);
  return wsId ? workspaces.get(wsId) || null : null;
}

// ─────────────────────────────────────────────────────────────
// GET /api/v1/workspace
// ─────────────────────────────────────────────────────────────

router.get('/workspace', (req: Request, res: Response) => {
  const user = authUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  let workspace = getWorkspace(user.id);
  if (!workspace) {
    workspace = provisionWorkspace(user);
  }

  res.json({ success: true, data: workspace });
});

function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    'PreD': 'Pre-Development',
    'Design': 'Design',
    'Development': 'Development',
    'Deployment': 'Deployment',
    'Debugging': 'Debugging'
  };
  return labels[phase] || phase;
}

function getPhaseDescription(phase: string): string {
  const descriptions: Record<string, string> = {
    'PreD': 'Before building anything, let\'s make sure this is worth doing. We\'ll research, validate, and define clear success criteria.',
    'Design': 'Let\'s design the solution carefully. We\'ll define the architecture, interfaces, and user flows before writing code.',
    'Development': 'Time to build. We\'ll implement features with clean, tested code, and review each step together.',
    'Deployment': 'Let\'s ship this safely. We\'ll verify everything in staging, set up monitoring, and prepare rollback plans.',
    'Debugging': 'Let\'s find the root cause. We\'ll reproduce, investigate, fix, and prevent recurrence.'
  };
  return descriptions[phase] || 'Let\'s figure out the best approach together.';
}

function getPhaseQuestions(phase: string, intent: { primaryIntent?: string; domain?: string; subject?: string }) {
  const allQuestions: Record<string, Array<{ id: string; question: string; type: string; options?: string[] }>> = {
    'PreD': [
      { id: 'urgency', question: 'How urgent is this?', type: 'choice', options: ['This week', 'This month', 'Next quarter', 'Just exploring'] },
      { id: 'budget', question: 'What\'s your approximate budget?', type: 'choice', options: ['Under $100', '$100-$500', '$500-$5,000', '$5,000+', 'Not sure yet'] },
      { id: 'audience', question: 'Who is this for?', type: 'text' },
    ],
    'Design': [
      { id: 'scale', question: 'How many users do you expect?', type: 'choice', options: ['Just me', 'Small team (2-10)', 'Business (10-1000)', 'Enterprise (1000+)'] },
      { id: 'timeline', question: 'When do you need this?', type: 'choice', options: ['ASAP', 'This month', 'This quarter', 'Flexible'] },
      { id: 'constraints', question: 'Any specific constraints or requirements?', type: 'text' },
    ],
    'Development': [
      { id: 'tech_pref', question: 'Do you have a preferred tech stack?', type: 'text' },
      { id: 'experience', question: 'What\'s your technical experience level?', type: 'choice', options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] },
      { id: 'collaborators', question: 'Will others be working on this too?', type: 'choice', options: ['Just me', '2-3 people', '4-10 people', '10+ people'] },
    ],
    'Deployment': [
      { id: 'platform', question: 'Where do you want to deploy?', type: 'choice', options: ['Vercel', 'AWS', 'Google Cloud', 'Custom server', 'Not sure'] },
      { id: 'domain', question: 'Do you have a domain name?', type: 'choice', options: ['Yes, I have one', 'No, I need one', 'Not applicable'] },
    ],
    'Debugging': [
      { id: 'impact', question: 'How severe is this issue?', type: 'choice', options: ['Critical (blocking work)', 'High (major impact)', 'Medium (inconvenient)', 'Low (cosmetic)'] },
      { id: 'recent_changes', question: 'What changed recently?', type: 'text' },
    ]
  };
  return allQuestions[phase] || allQuestions['Development'];
}

function generateDashboard(user: User): Record<string, unknown> {
  return {
    greeting: `Welcome back, ${user.name.split(' ')[0]}`,
    phase: user.onboardingData.phase || 'General',
    intent: user.onboardingData.intent,
    goals: user.onboardingData.goals,
    suggestedAgents: ['Hermes'],
    suggestedSkills: getSuggestedSkills(user.onboardingData.intent?.domain || 'general'),
    quickActions: ['Start a new chat', 'Browse skills', 'Explore agents']
  };
}

function getSuggestedSkills(domain: string): string[] {
  const skills: Record<string, string[]> = {
    'code': ['PAL Compiler', 'NPAO Router', 'Instruction Architect'],
    'design': ['Diagram Builder', 'PRD Builder', 'JTBD Builder'],
    'research': ['JTBD Builder', 'PAL Compiler'],
    'ops': ['NPAO Router', 'Instruction Architect'],
    'sales': ['Small Biz Starter', 'JTBD Builder'],
    'content': ['Press Kit Maker', 'Resume Builder'],
    'deploy': ['PAL Compiler', 'NPAO Router'],
    'debug': ['PAL Compiler', 'Instruction Architect'],
    'general': ['PAL Compiler', 'Resume Builder', 'Trip Planner', 'Meal Prep'],
  };
  return skills[domain] || skills['general'];
}

export { authUser };
export default router;
