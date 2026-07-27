/**
 * PAL Compiler - Stage 1: Intent Extraction
 * Transforms loose natural language into structured intent
 */
// Domain classification keywords
const DOMAIN_PATTERNS = {
    code: ['code', 'function', 'implement', 'build', 'create', 'develop', 'write', 'program', 'script', 'api', 'backend', 'frontend', 'fix bug', 'refactor'],
    design: ['design', 'architecture', 'spec', 'blueprint', 'schema', 'diagram', 'ui', 'ux', 'wireframe', 'mockup', 'layout'],
    research: ['research', 'find', 'search', 'look up', 'investigate', 'analyze', 'compare', 'learn about', 'what is', 'how does', 'explain'],
    ops: ['deploy', 'setup', 'configure', 'install', 'migrate', 'scale', 'monitor', 'infrastructure', 'ci/cd', 'pipeline'],
    sales: ['pitch', 'proposal', 'outreach', 'lead', 'prospect', 'crm', 'deal', 'contract', 'pricing', 'quote'],
    content: ['write', 'blog', 'article', 'post', 'email', 'copy', 'content', 'document', 'readme', 'documentation'],
    deploy: ['ship', 'release', 'launch', 'publish', 'go live', 'production', 'deploy', 'rollout'],
    debug: ['debug', 'fix', 'error', 'bug', 'issue', 'problem', 'broken', 'not working', 'failing', 'crash']
};
// Urgency indicators
const URGENCY_PATTERNS = {
    immediate: ['urgent', 'asap', 'now', 'immediately', 'critical', 'emergency', 'blocking', 'p0', 'p1'],
    scheduled: ['schedule', 'later', 'tomorrow', 'next week', 'when you can', 'no rush'],
    queued: [] // default
};
export function extractIntent(ctx) {
    const { userPrompt, attachments } = ctx;
    const lowerPrompt = userPrompt.toLowerCase();
    // Extract domain
    const domain = classifyDomain(lowerPrompt);
    // Extract primary intent (verb + object)
    const primaryIntent = extractPrimaryIntent(userPrompt);
    // Extract subject
    const subject = extractSubject(userPrompt, attachments);
    // Extract constraints
    const constraints = extractConstraints(userPrompt);
    // Infer desired output
    const desiredOutput = inferDesiredOutput(domain, primaryIntent, userPrompt);
    // Determine urgency
    const urgency = classifyUrgency(lowerPrompt);
    // Calculate ambiguity score
    const ambiguityScore = calculateAmbiguity(userPrompt, primaryIntent, subject, constraints);
    return {
        primaryIntent,
        domain,
        subject,
        constraints,
        desiredOutput,
        urgency,
        ambiguityScore
    };
}
function classifyDomain(prompt) {
    const scores = {
        code: 0, design: 0, research: 0, ops: 0,
        sales: 0, content: 0, deploy: 0, debug: 0
    };
    for (const [domain, patterns] of Object.entries(DOMAIN_PATTERNS)) {
        for (const pattern of patterns) {
            if (prompt.includes(pattern)) {
                scores[domain] += 1;
            }
        }
    }
    // Find highest scoring domain
    let maxDomain = 'research'; // default
    let maxScore = 0;
    for (const [domain, score] of Object.entries(scores)) {
        if (score > maxScore) {
            maxScore = score;
            maxDomain = domain;
        }
    }
    return maxDomain;
}
function extractPrimaryIntent(prompt) {
    // Look for verb + object patterns
    const verbPatterns = [
        /^(create|build|make|develop|implement|write|generate)\s+(.+?)(?:\s+that|\s+which|\s+for|$)/i,
        /^(find|search|research|look up|investigate)\s+(.+?)(?:\s+about|\s+for|$)/i,
        /^(fix|debug|resolve|solve)\s+(.+?)(?:\s+in|\s+with|$)/i,
        /^(deploy|ship|release|launch)\s+(.+?)(?:\s+to|\s+on|$)/i,
        /^(design|architect|plan|spec)\s+(.+?)(?:\s+for|\s+with|$)/i,
        /^(help\s+(?:me\s+)?)?(.+)/i
    ];
    for (const pattern of verbPatterns) {
        const match = prompt.match(pattern);
        if (match) {
            const verb = match[1]?.toLowerCase().replace(/help\s+me\s+/i, '') || 'do';
            const object = match[2]?.trim().slice(0, 100) || '';
            if (object) {
                return `${verb} ${object}`;
            }
        }
    }
    // Fallback: first 100 chars
    return prompt.slice(0, 100).trim();
}
function extractSubject(prompt, attachments) {
    // Check attachments first
    if (attachments?.length) {
        const firstAttachment = attachments[0];
        if (firstAttachment.name) {
            return firstAttachment.name;
        }
    }
    // Look for quoted strings
    const quotedMatch = prompt.match(/"([^"]+)"|'([^']+)'|`([^`]+)`/);
    if (quotedMatch) {
        return quotedMatch[1] || quotedMatch[2] || quotedMatch[3];
    }
    // Look for "the X" or "my X" patterns
    const theMatch = prompt.match(/(?:the|my|this|our)\s+(\w+(?:\s+\w+)?)/i);
    if (theMatch) {
        return theMatch[1];
    }
    // Extract main noun phrase (simplified)
    const words = prompt.split(/\s+/).filter(w => w.length > 2);
    return words.slice(0, 3).join(' ');
}
function extractConstraints(prompt) {
    const constraints = [];
    // Time constraints
    const timeMatch = prompt.match(/(?:within|in|by|before)\s+(\d+\s+(?:minute|hour|day|week)s?)/i);
    if (timeMatch) {
        constraints.push(`Time: ${timeMatch[1]}`);
    }
    // Technology constraints
    const techPatterns = [
        /using\s+(typescript|javascript|python|react|node|aws|gcp|azure)/gi,
        /with\s+(typescript|javascript|python|react|node|aws|gcp|azure)/gi,
        /in\s+(typescript|javascript|python|react|node)/gi
    ];
    for (const pattern of techPatterns) {
        const matches = prompt.matchAll(pattern);
        for (const match of matches) {
            constraints.push(`Tech: ${match[1]}`);
        }
    }
    // Quality constraints
    if (/production|prod|live/i.test(prompt)) {
        constraints.push('Quality: Production-grade');
    }
    if (/test|testing|tested/i.test(prompt)) {
        constraints.push('Quality: Must have tests');
    }
    if (/secure|security/i.test(prompt)) {
        constraints.push('Quality: Security-focused');
    }
    // Scope constraints
    if (/simple|basic|minimal|mvp/i.test(prompt)) {
        constraints.push('Scope: Minimal/MVP');
    }
    if (/comprehensive|complete|full/i.test(prompt)) {
        constraints.push('Scope: Comprehensive');
    }
    return constraints;
}
function inferDesiredOutput(domain, intent, prompt) {
    const outputMap = {
        code: 'Working, tested code',
        design: 'Architecture diagram and specification',
        research: 'Research brief with sources',
        ops: 'Configured infrastructure or pipeline',
        sales: 'Sales collateral or outreach content',
        content: 'Polished document or content',
        deploy: 'Live, monitored deployment',
        debug: 'Fixed issue with root cause documented'
    };
    // Check for explicit output requests
    if (/give me|provide|return|output/i.test(prompt)) {
        const outputMatch = prompt.match(/(?:give me|provide|return|output)\s+(?:a\s+)?(.+?)(?:\.|,|$)/i);
        if (outputMatch) {
            return outputMatch[1].trim();
        }
    }
    return outputMap[domain];
}
function classifyUrgency(prompt) {
    for (const pattern of URGENCY_PATTERNS.immediate) {
        if (prompt.includes(pattern)) {
            return 'immediate';
        }
    }
    for (const pattern of URGENCY_PATTERNS.scheduled) {
        if (prompt.includes(pattern)) {
            return 'scheduled';
        }
    }
    return 'queued';
}
function calculateAmbiguity(prompt, intent, subject, constraints) {
    let score = 0;
    // Short prompts are more ambiguous
    if (prompt.length < 20)
        score += 0.3;
    else if (prompt.length < 50)
        score += 0.1;
    // Missing clear subject
    if (!subject || subject.split(' ').length > 3)
        score += 0.2;
    // No constraints means less clarity
    if (constraints.length === 0)
        score += 0.2;
    // Vague words increase ambiguity
    const vagueWords = ['something', 'stuff', 'thing', 'it', 'that', 'maybe', 'perhaps', 'might'];
    for (const word of vagueWords) {
        if (prompt.toLowerCase().includes(word)) {
            score += 0.05;
        }
    }
    // Questions without clear answers
    if (/^(what|how|why|when|where|who)\s/i.test(prompt) && prompt.length < 50) {
        score += 0.1;
    }
    return Math.min(1, score);
}
//# sourceMappingURL=intent.js.map