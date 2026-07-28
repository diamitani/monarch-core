/**
 * Auth Routes — AWS Cognito + DynamoDB backed
 * Real auth with Cognito User Pools, JWT verification, DynamoDB storage
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  AdminConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import { compile } from '@monarch/pal-compiler';
import { createLogger } from '@monarch/shared';

const router: Router = Router();
const logger = createLogger('auth-api');

// ─────────────────────────────────────────────────────────────
// AWS Clients
// ─────────────────────────────────────────────────────────────

const cognito = new CognitoIdentityProviderClient({ region: 'us-east-1' });
const dynamo = new DynamoDBClient({ region: 'us-east-1' });

const USER_POOL_ID = 'us-east-1_5BgSdMUej';
const CLIENT_ID = '2jbogduhjfu73gth4glk06orfh';

// ─────────────────────────────────────────────────────────────
// DynamoDB Helpers
// ─────────────────────────────────────────────────────────────

async function putUser(userId: string, data: Record<string, unknown>) {
  await dynamo.send(new PutItemCommand({
    TableName: 'monarch-users',
    Item: {
      userId: { S: userId },
      ...Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? { S: v } : { S: JSON.stringify(v) }])
      ),
      createdAt: { S: new Date().toISOString() },
    },
  }));
}

async function getUser(userId: string): Promise<Record<string, string> | null> {
  const result = await dynamo.send(new GetItemCommand({
    TableName: 'monarch-users',
    Key: { userId: { S: userId } },
  }));
  if (!result.Item) return null;
  const item: Record<string, string> = {};
  for (const [k, v] of Object.entries(result.Item)) {
    item[k] = v.S || '';
  }
  return item;
}

async function putWorkspace(workspaceId: string, data: Record<string, unknown>) {
  await dynamo.send(new PutItemCommand({
    TableName: 'monarch-workspaces',
    Item: {
      workspaceId: { S: workspaceId },
      ...Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? { S: v } : { S: JSON.stringify(v) }])
      ),
      createdAt: { S: new Date().toISOString() },
    },
  }));
}

async function getWorkspace(workspaceId: string): Promise<Record<string, string> | null> {
  const result = await dynamo.send(new GetItemCommand({
    TableName: 'monarch-workspaces',
    Key: { workspaceId: { S: workspaceId } },
  }));
  if (!result.Item) return null;
  const item: Record<string, string> = {};
  for (const [k, v] of Object.entries(result.Item)) {
    item[k] = v.S || '';
  }
  return item;
}

// ─────────────────────────────────────────────────────────────
// Cognito Token Verification
// ─────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const jwks = jwksClient({
  jwksUri: `https://cognito-idp.us-east-1.amazonaws.com/${USER_POOL_ID}/.well-known/jwks.json`,
});

function verifyToken(token: string): Promise<{ sub: string; email: string; name: string } | null> {
  return new Promise((resolve) => {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded?.header?.kid) { resolve(null); return; }

    jwks.getSigningKey(decoded.header.kid, (err, key) => {
      if (err) { resolve(null); return; }
      try {
        const payload = jwt.verify(token, key!.getPublicKey(), {
          issuer: `https://cognito-idp.us-east-1.amazonaws.com/${USER_POOL_ID}`,
        }) as jwt.JwtPayload;
        resolve({
          sub: payload.sub || '',
          email: (payload.email as string) || '',
          name: (payload.name as string) || '',
        });
      } catch {
        resolve(null);
      }
    });
  });
}

async function authUser(req: Request): Promise<{ sub: string; email: string; name: string } | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
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

    if (password.length < 8) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' }
      });
      return;
    }

    // Sign up via Cognito
    const signupResult = await cognito.send(new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email.toLowerCase(),
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email.toLowerCase() },
        { Name: 'name', Value: name },
      ],
    }));

    const userId = signupResult.UserSub || `user_${crypto.randomBytes(12).toString('hex')}`;

    // Store user profile in DynamoDB
    await putUser(userId, {
      email: email.toLowerCase(),
      name,
      onboardingPhase: 'signup',
      onboardingData: '{}',
    });

    // Auto-confirm user
    try {
      await cognito.send(new AdminConfirmSignUpCommand({
        UserPoolId: USER_POOL_ID,
        Username: email.toLowerCase(),
      }));
    } catch {}

    logger.info('User signed up via Cognito', { userId, email: email.toLowerCase() });

    res.status(201).json({
      success: true,
      data: {
        user: { id: userId, email: email.toLowerCase(), name, onboardingPhase: 'classify' },
        message: 'Account created. Please sign in.',
      },
      nextStep: 'classify'
    });

  } catch (error: any) {
    if (error.name === 'UsernameExistsException') {
      res.status(409).json({
        success: false,
        error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists' }
      });
      return;
    }
    logger.error('Signup failed', error);
    res.status(500).json({
      success: false,
      error: { code: 'SIGNUP_ERROR', message: error.message }
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/login
// ─────────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email and password are required' }
      });
      return;
    }

    // Authenticate via Cognito
    const authResult = await cognito.send(new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email.toLowerCase(),
        PASSWORD: password,
      },
    }));

    const idToken = authResult.AuthenticationResult?.IdToken;
    const accessToken = authResult.AuthenticationResult?.AccessToken;
    const refreshToken = authResult.AuthenticationResult?.RefreshToken;

    if (!idToken) {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
      return;
    }

    // Decode token to get user info
    const decoded = jwt.decode(idToken) as jwt.JwtPayload;
    const userId = decoded.sub || '';

    // Get user profile from DynamoDB
    const user = await getUser(userId);

    res.json({
      success: true,
      data: {
        user: {
          id: userId,
          email: email.toLowerCase(),
          name: decoded.name || '',
          onboardingPhase: user?.onboardingPhase || 'signup',
        },
        tokens: { idToken, accessToken, refreshToken },
      },
      nextStep: (user?.onboardingPhase === 'complete') ? 'dashboard' : 'onboarding'
    });

  } catch (error: any) {
    if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
      res.status(401).json({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }
      });
      return;
    }
    logger.error('Login failed', error);
    res.status(500).json({
      success: false,
      error: { code: 'LOGIN_ERROR', message: error.message }
    });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/onboarding/classify
// ─────────────────────────────────────────────────────────────

router.post('/onboarding/classify', async (req: Request, res: Response) => {
  const user = await authUser(req);
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

    const palOutput = await compile({ userPrompt: goal, attachments: [] });

    const onboardingData = {
      intent: {
        primaryIntent: palOutput.extractedIntent.primaryIntent,
        domain: palOutput.extractedIntent.domain,
        subject: palOutput.extractedIntent.subject,
      },
      phase: palOutput.manifest.phase,
      goals: [goal],
    };

    await putUser(user.sub, {
      onboardingPhase: 'classify',
      onboardingData: JSON.stringify(onboardingData),
    });

    const questions = getPhaseQuestions(palOutput.manifest.phase, palOutput.extractedIntent);

    res.json({
      success: true,
      data: {
        phase: palOutput.manifest.phase,
        phaseLabel: getPhaseLabel(palOutput.manifest.phase),
        phaseDescription: getPhaseDescription(palOutput.manifest.phase),
        intent: { primaryGoal: palOutput.extractedIntent.primaryIntent, domain: palOutput.extractedIntent.domain, subject: palOutput.extractedIntent.subject },
        confidence: palOutput.confidence,
        questions,
      }
    });

  } catch (error: any) {
    logger.error('Onboarding classify failed', error);
    res.status(500).json({ success: false, error: { code: 'CLASSIFY_ERROR', message: error.message } });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/v1/auth/onboarding/complete
// ─────────────────────────────────────────────────────────────

router.post('/onboarding/complete', async (req: Request, res: Response) => {
  const user = await authUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  try {
    const { preferences } = req.body as { preferences?: Record<string, string> };
    const userData = await getUser(user.sub);
    const onboardingData = userData?.onboardingData ? JSON.parse(userData.onboardingData) : {};

    onboardingData.preferences = preferences || {};

    await putUser(user.sub, {
      onboardingPhase: 'complete',
      onboardingData: JSON.stringify(onboardingData),
    });

    // Provision workspace
    const workspaceId = `ws_${crypto.randomBytes(8).toString('hex')}`;
    const projectId = `proj_${crypto.randomBytes(6).toString('hex')}`;
    await putWorkspace(workspaceId, {
      userId: user.sub,
      name: `${user.name}'s Workspace`,
      projects: JSON.stringify([{ id: projectId, name: 'Default Project', status: 'active', createdAt: new Date().toISOString() }]),
      sessions: '[]',
    });

    res.json({
      success: true,
      data: {
        user: { id: user.sub, email: user.email, name: user.name, onboardingPhase: 'complete' },
        workspace: { id: workspaceId, name: `${user.name}'s Workspace`, projects: [{ id: projectId, name: 'Default Project', status: 'active' }] },
        dashboard: generateDashboard(onboardingData, user.name),
      }
    });

  } catch (error: any) {
    logger.error('Onboarding complete failed', error);
    res.status(500).json({ success: false, error: { code: 'ONBOARDING_ERROR', message: error.message } });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/auth/me
// ─────────────────────────────────────────────────────────────

router.get('/me', async (req: Request, res: Response) => {
  const user = await authUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  const userData = await getUser(user.sub);
  const onboardingData = userData?.onboardingData ? JSON.parse(userData.onboardingData) : {};
  const isComplete = userData?.onboardingPhase === 'complete';

  res.json({
    success: true,
    data: {
      user: { id: user.sub, email: user.email, name: user.name, onboardingPhase: userData?.onboardingPhase || 'signup' },
      dashboard: isComplete ? generateDashboard(onboardingData, user.name) : null,
    }
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/workspace
// ─────────────────────────────────────────────────────────────

router.get('/workspace', async (req: Request, res: Response) => {
  const user = await authUser(req);
  if (!user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    return;
  }

  // Find workspace by userId (would need a GSI in production)
  // For MVP, store workspaceId in user record
  res.json({ success: true, data: { message: 'Workspace lookup via GSI coming soon' } });
});

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getPhaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    'PreD': 'Pre-Development', 'Design': 'Design', 'Development': 'Development',
    'Deployment': 'Deployment', 'Debugging': 'Debugging'
  };
  return labels[phase] || phase;
}

function getPhaseDescription(phase: string): string {
  const descriptions: Record<string, string> = {
    'PreD': "Before building anything, let's make sure this is worth doing.",
    'Design': "Let's design the solution carefully.",
    'Development': 'Time to build. Clean, tested code.',
    'Deployment': "Let's ship this safely.",
    'Debugging': "Let's find the root cause."
  };
  return descriptions[phase] || "Let's figure out the best approach together.";
}

function getPhaseQuestions(phase: string, _intent: unknown) {
  const questions: Record<string, Array<{ id: string; question: string; type: string; options?: string[] }>> = {
    'PreD': [
      { id: 'urgency', question: 'How urgent is this?', type: 'choice', options: ['This week', 'This month', 'Next quarter', 'Just exploring'] },
      { id: 'budget', question: "What's your approximate budget?", type: 'choice', options: ['Under $100', '$100-$500', '$500-$5,000', '$5,000+'] },
    ],
    'Development': [
      { id: 'tech_pref', question: 'Do you have a preferred tech stack?', type: 'text' },
      { id: 'experience', question: "What's your technical experience level?", type: 'choice', options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] },
    ],
  };
  return questions[phase] || questions['Development'];
}

function generateDashboard(data: Record<string, unknown>, name: string) {
  const intent = data.intent as Record<string, string> | undefined;
  return {
    greeting: `Welcome back, ${name.split(' ')[0]}`,
    phase: (data.phase as string) || 'General',
    intent,
    goals: data.goals as string[],
    suggestedAgents: ['Hermes'],
    suggestedSkills: ['PAL Compiler', 'NPAO Router', 'Instruction Architect'],
    quickActions: ['Start a new chat', 'Browse skills', 'Explore agents'],
  };
}

export { authUser };
export default router;
