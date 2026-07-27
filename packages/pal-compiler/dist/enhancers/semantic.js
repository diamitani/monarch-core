/**
 * PAL Compiler - Stage 3: Semantic Enhancement
 * Transforms extracted intent into precise, actionable instructions
 */
// Enhancement rules by domain
const DOMAIN_ENHANCEMENTS = {
    code: {
        verbExpansions: {
            'improve': 'identify top 3 issues by severity, propose specific fix for each',
            'create': 'implement with proper error handling, types, and basic tests',
            'fix': 'diagnose root cause, implement fix, verify with test case',
            'refactor': 'restructure while maintaining behavior, add tests if missing'
        },
        defaultCriteria: [
            'Code compiles without errors',
            'All existing tests pass',
            'New functionality has test coverage',
            'No security vulnerabilities introduced'
        ],
        requiresApproval: false
    },
    design: {
        verbExpansions: {
            'design': 'create detailed specification with diagrams, data models, and API contracts',
            'architect': 'define system boundaries, components, data flow, and failure modes',
            'plan': 'break down into phases with deliverables, dependencies, and time estimates'
        },
        defaultCriteria: [
            'Architecture diagram exists',
            'Data models defined',
            'API contracts specified',
            'Edge cases documented'
        ],
        requiresApproval: false
    },
    research: {
        verbExpansions: {
            'research': 'gather information from authoritative sources, synthesize findings, cite sources',
            'find': 'search multiple sources, verify accuracy, rank by relevance',
            'compare': 'create comparison matrix with criteria, pros/cons, recommendation'
        },
        defaultCriteria: [
            'Multiple sources consulted',
            'Sources cited',
            'Key findings summarized',
            'Confidence level stated'
        ],
        requiresApproval: false
    },
    ops: {
        verbExpansions: {
            'setup': 'configure with security best practices, monitoring, and documentation',
            'deploy': 'deploy with rollback plan, health checks, and monitoring',
            'migrate': 'create migration plan, backup, execute with verification steps'
        },
        defaultCriteria: [
            'Configuration documented',
            'Security reviewed',
            'Monitoring enabled',
            'Rollback procedure defined'
        ],
        requiresApproval: true
    },
    sales: {
        verbExpansions: {
            'pitch': 'create value proposition, objection handlers, and call-to-action',
            'proposal': 'draft with problem statement, solution, pricing, and timeline',
            'outreach': 'personalize based on prospect research, include clear ask'
        },
        defaultCriteria: [
            'Value proposition clear',
            'Call-to-action defined',
            'Personalized to recipient',
            'Follow-up plan included'
        ],
        requiresApproval: false
    },
    content: {
        verbExpansions: {
            'write': 'draft with clear structure, engaging hook, and strong conclusion',
            'blog': 'create SEO-optimized post with meta description and internal links',
            'document': 'create with clear sections, examples, and table of contents'
        },
        defaultCriteria: [
            'Clear structure',
            'Appropriate tone',
            'Error-free grammar',
            'Meets length requirement'
        ],
        requiresApproval: false
    },
    deploy: {
        verbExpansions: {
            'ship': 'deploy to production with staged rollout, monitoring, and rollback ready',
            'release': 'create release notes, deploy, verify functionality',
            'launch': 'execute launch checklist, verify all systems, announce'
        },
        defaultCriteria: [
            'Staging verified',
            'Production deployed',
            'Health checks passing',
            'Monitoring active'
        ],
        requiresApproval: true
    },
    debug: {
        verbExpansions: {
            'debug': 'reproduce issue, identify root cause, implement and verify fix',
            'fix': 'diagnose, fix, add regression test, document resolution',
            'investigate': 'gather evidence, form hypothesis, test systematically'
        },
        defaultCriteria: [
            'Issue reproduced',
            'Root cause identified',
            'Fix implemented',
            'Regression test added'
        ],
        requiresApproval: false
    }
};
export function enhanceIntent(intent) {
    const domainConfig = DOMAIN_ENHANCEMENTS[intent.domain];
    // Expand vague verbs
    let enhancedPrompt = expandVerbs(intent.primaryIntent, domainConfig.verbExpansions);
    // Add precision from constraints
    if (intent.constraints.length > 0) {
        enhancedPrompt += `. Constraints: ${intent.constraints.join('; ')}`;
    }
    // Add success criteria
    enhancedPrompt += `. Success criteria: ${intent.desiredOutput}`;
    // Remove hedging language
    enhancedPrompt = removeHedging(enhancedPrompt);
    // Add domain-specific best practices
    enhancedPrompt = addBestPractices(enhancedPrompt, intent.domain);
    // Determine success criteria
    const successCriteria = deriveSuccessCriteria(intent, domainConfig.defaultCriteria);
    // Determine escalation policy based on urgency and domain
    const escalationPolicy = deriveEscalationPolicy(intent, domainConfig.requiresApproval);
    return {
        enhancedPrompt,
        successCriteria,
        escalationPolicy
    };
}
function expandVerbs(prompt, expansions) {
    let result = prompt;
    for (const [verb, expansion] of Object.entries(expansions)) {
        const regex = new RegExp(`\\b${verb}\\b`, 'gi');
        if (regex.test(result)) {
            result = result.replace(regex, expansion);
            break; // Only expand first matching verb
        }
    }
    return result;
}
function removeHedging(prompt) {
    const hedgingPatterns = [
        [/\bmaybe we should\b/gi, 'do'],
        [/\bperhaps\b/gi, ''],
        [/\bI think\b/gi, ''],
        [/\bkind of\b/gi, ''],
        [/\bsort of\b/gi, ''],
        [/\bpossibly\b/gi, ''],
        [/\bif you could\b/gi, ''],
        [/\bif possible\b/gi, ''],
        [/\btry to\b/gi, ''],
        [/\battempt to\b/gi, '']
    ];
    let result = prompt;
    for (const [pattern, replacement] of hedgingPatterns) {
        result = result.replace(pattern, replacement);
    }
    // Clean up double spaces
    return result.replace(/\s+/g, ' ').trim();
}
function addBestPractices(prompt, domain) {
    const practices = {
        code: ['Follow existing code conventions', 'Add inline comments for complex logic'],
        design: ['Consider scalability', 'Document assumptions'],
        research: ['Prioritize authoritative sources', 'Note conflicting information'],
        ops: ['Use infrastructure as code', 'Enable logging'],
        sales: ['Focus on customer pain points', 'Include social proof'],
        content: ['Write for the target audience', 'Include call-to-action'],
        deploy: ['Use blue-green or canary deployment', 'Set up alerts'],
        debug: ['Check logs first', 'Isolate the problem']
    };
    const domainPractices = practices[domain];
    if (domainPractices && domainPractices.length > 0) {
        return `${prompt}. Best practices: ${domainPractices.join('; ')}`;
    }
    return prompt;
}
function deriveSuccessCriteria(intent, defaultCriteria) {
    const criteria = [...defaultCriteria];
    // Add criteria from constraints
    for (const constraint of intent.constraints) {
        if (constraint.startsWith('Quality:')) {
            criteria.push(constraint.replace('Quality:', '').trim());
        }
        if (constraint.startsWith('Time:')) {
            criteria.push(`Completed ${constraint.replace('Time:', '').trim()}`);
        }
    }
    // Add desired output as final criterion
    criteria.push(intent.desiredOutput);
    return [...new Set(criteria)]; // Dedupe
}
function deriveEscalationPolicy(intent, requiresApproval) {
    // High ambiguity always needs human review
    if (intent.ambiguityScore > 0.6) {
        return 'human-in-loop';
    }
    // Immediate urgency with low ambiguity can auto-proceed
    if (intent.urgency === 'immediate' && intent.ambiguityScore < 0.3 && !requiresApproval) {
        return 'auto-proceed';
    }
    // Domain requires approval (ops, deploy)
    if (requiresApproval) {
        return 'require-approval';
    }
    // Default based on ambiguity
    return intent.ambiguityScore > 0.4 ? 'require-approval' : 'auto-proceed';
}
//# sourceMappingURL=semantic.js.map