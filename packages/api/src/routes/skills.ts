/**
 * ROSTR Skill Engine — modular skill system that enhances system prompts
 * Each skill adds domain-specific context, instructions, and tool access
 */

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: 'compile' | 'route' | 'retrieve' | 'build' | 'verify' | 'deploy';
  /** Prompt fragment appended to system instructions when skill is enabled */
  systemPrompt: string;
  /** ROSTR phases this skill is most useful for */
  phases: string[];
  /** Whether this skill requires tool access */
  requiresTools?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Skill Registry
// ─────────────────────────────────────────────────────────────

export const ROSTR_SKILLS: Skill[] = [
  {
    id: 'pal-compiler',
    name: 'PAL Compiler',
    description: 'Compiles vague intent into precise, executable agent manifests',
    category: 'compile',
    phases: ['all'],
    systemPrompt: `PAL COMPILER (active):
- Extract the user's core intent: what do they actually want done?
- Identify the domain (code, design, research, ops, sales, content, deploy, debug)
- Identify the subject being acted upon
- Set clear completion criteria: what does "done" look like?
- If the request is ambiguous, ask ONE clarifying question before proceeding
- Never guess the domain — when uncertain, default to "general"`,
  },
  {
    id: 'npao-router',
    name: 'NPAO Router',
    description: 'Scores tasks on 4D priority and routes to the best approach',
    category: 'route',
    phases: ['all'],
    systemPrompt: `NPAO ROUTER (active):
- Classify this task into a ROSTR phase: PreD (validate), Design (architect), Development (build), Deployment (ship), Debugging (fix)
- Score urgency (0-10): how time-sensitive is this?
- Score dependency impact (0-10): what's blocked by this?  
- Score business impact (0-10): what happens if this isn't done?
- Score resource efficiency (0-10): quick win or heavy lift?
- Recommend: do immediately (≥7), queue (4-6), or backlog (<4)
- Output the phase and priority at the start of your response`,
  },
  {
    id: 'rag-dal',
    name: 'RAG DAL',
    description: 'Multi-pass retrieval with source credibility tiers and coverage validation',
    category: 'retrieve',
    phases: ['pred', 'design', 'debug'],
    requiresTools: true,
    systemPrompt: `RAG DAL (active):
- When researching, use a 3-tier source strategy:
  Tier 1 (credibility 1.0): Academic papers, official docs, standards bodies — for ground truth
  Tier 2 (credibility 0.75): Major publications, analyst reports, trade journals — for context
  Tier 3 (credibility 0.40): Blogs, forums, community posts — for signal and edge cases
- Require ≥2 Tier 1/2 sources confirming any factual claim
- If confidence < 0.8 on any sub-topic, flag it explicitly
- Mark clearly what you know vs what you're less certain about`,
  },
  {
    id: 'phase-router',
    name: 'Phase Router',
    description: 'Routes behavior based on ROSTR 5D phase detection',
    category: 'route',
    phases: ['all'],
    systemPrompt: `PHASE ROUTER (active) — Current phase behaviors:

PreD (Pre-Development): Validate before building. Research alternatives. Define success criteria. Ask "is this worth building?" DO NOT write code.

Design: Architect before coding. Define interfaces, data models, user flows. Ask "what exactly are we building?"

Development: Build with clean patterns. Write tests. Follow conventions. Ask "does it work?"

Deployment: Ship safely. Verify in staging. Monitor. Have rollback plans. Ask "is it safe to ship?"

Debugging: Find root cause, not symptoms. Reproduce first. Add regression tests. Ask "what broke and why?"`,
  },
  {
    id: 'instruction-architect',
    name: 'Instruction Architect',
    description: 'Refines prompts for precision, removing ambiguity and hedging',
    category: 'compile',
    phases: ['all'],
    systemPrompt: `INSTRUCTION ARCHITECT (active):
- Expand ambiguous verbs: "improve" → "identify top 3 issues by severity, propose specific fix for each"
- Add missing precision: success criteria, output format, verification method
- Decompose compound goals into sequential steps
- Remove hedging: "maybe we should" → "do X"
- Inject domain best practices automatically`,
  },
  {
    id: 'jtbd-builder',
    name: 'JTBD Builder',
    description: 'Apply Jobs-to-be-Done framework to understand user needs',
    category: 'compile',
    phases: ['pred', 'design'],
    systemPrompt: `JTBD BUILDER (active):
- Frame the user's goal as a Job-to-be-Done: "When [situation], I want to [motivation], so I can [expected outcome]"
- Identify functional, emotional, and social dimensions of the job
- Look for "hiring" and "firing" signals: what are they switching from?
- Define success in the user's terms, not the system's terms`,
  },
  {
    id: 'diagram-builder',
    name: 'Diagram Builder',
    description: 'Describe systems and get clean architecture diagrams',
    category: 'build',
    phases: ['design'],
    systemPrompt: `DIAGRAM BUILDER (active):
- When describing architecture, use clear ASCII art or Mermaid syntax
- Show flow direction: data flows left→right or top→bottom
- Label all components, connections, and boundaries
- Highlight async vs sync, read vs write paths`,
  },
  {
    id: 'prd-builder',
    name: 'PRD Builder',
    description: 'Turn rough ideas into structured product specs',
    category: 'build',
    phases: ['pred', 'design'],
    systemPrompt: `PRD BUILDER (active):
- Structure responses as: Problem → Solution → Success Metrics → Scope → Risks
- Define clear acceptance criteria for each feature
- Identify non-goals explicitly: what are we NOT building?
- Include user stories in "As a [role], I want [feature], so that [value]" format`,
  },
];

// ─────────────────────────────────────────────────────────────
// Skill Engine
// ─────────────────────────────────────────────────────────────

export function getSkillById(id: string): Skill | undefined {
  return ROSTR_SKILLS.find((s) => s.id === id);
}

export function getSkillsByCategory(category: Skill['category']): Skill[] {
  return ROSTR_SKILLS.filter((s) => s.category === category);
}

export function getSkillsByPhase(phase: string): Skill[] {
  return ROSTR_SKILLS.filter((s) => s.phases.includes('all') || s.phases.includes(phase.toLowerCase()));
}

/**
 * Build a ROSTR-enhanced system prompt from enabled skill IDs
 */
export function buildSkillPrompt(enabledSkillIds: string[], phase?: string): string {
  if (enabledSkillIds.length === 0) return '';

  const skills = enabledSkillIds
    .map((id) => getSkillById(id))
    .filter((s): s is Skill => s !== undefined);

  if (skills.length === 0) return '';

  const sections: string[] = [
    '=== ROSTR SKILLS ACTIVE ===',
    `Enabled: ${skills.map((s) => s.name).join(', ')}`,
    '',
  ];

  // Phase detection goes first
  const phaseSkill = skills.find((s) => s.id === 'phase-router');
  if (phaseSkill) {
    sections.push(phaseSkill.systemPrompt);
  }

  // Compile skills
  const compileSkills = skills.filter((s) => s.category === 'compile');
  if (compileSkills.length > 0) {
    sections.push(...compileSkills.map((s) => s.systemPrompt));
  }

  // Route skills
  const routeSkills = skills.filter((s) => s.category === 'route' && s.id !== 'phase-router');
  if (routeSkills.length > 0) {
    sections.push(...routeSkills.map((s) => s.systemPrompt));
  }

  // Retrieve skills
  const retrieveSkills = skills.filter((s) => s.category === 'retrieve');
  if (retrieveSkills.length > 0) {
    sections.push(...retrieveSkills.map((s) => s.systemPrompt));
  }

  // Build/Verify/Deploy
  const buildSkills = skills.filter((s) => s.category === 'build' || s.category === 'verify' || s.category === 'deploy');
  if (buildSkills.length > 0) {
    sections.push(...buildSkills.map((s) => s.systemPrompt));
  }

  return sections.join('\n\n');
}

/**
 * Get all skill metadata for the frontend skill picker
 */
export function getSkillCatalog() {
  return ROSTR_SKILLS.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    phases: s.phases,
    requiresTools: s.requiresTools || false,
  }));
}
