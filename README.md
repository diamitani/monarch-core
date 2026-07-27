# Monarch Core

**Production-grade multi-agent runtime powered by AWS Bedrock AgentCore**

Monarch Core eliminates 3,000+ lines of custom orchestration code by using Bedrock Agent Core as the execution layer. This gives you:

- ✅ Durable task execution with automatic retries
- ✅ Bidirectional streaming out of the box
- ✅ Long-term memory with RAG built-in
- ✅ Tool orchestration (Web search, Composio integrations, custom)
- ✅ Session lifecycle management
- ✅ Observability via CloudWatch traces

## Architecture

```
┌─────────────────────────────────────────────┐
│   Frontend (Next.js + streaming)            │
│   - Chat UI with real-time progress         │
│   - Project workspace + artifacts           │
└──────────────┬──────────────────────────────┘
               │ (SSE)
               ↓
┌─────────────────────────────────────────────┐
│   API (Express + TypeScript)                │
│   - PAL Compiler (intent → manifest)        │
│   - Session management                      │
│   - Route to AgentCore Runtime              │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────┐
│      BEDROCK AGENT CORE RUNTIME (Managed)            │
│  - Agent Execution Engine                            │
│  - Memory System (200K context + long-term)          │
│  - Built-In Tools (web search, code interpreter)     │
└──────────────┬───────────────────────────────────────┘
               │
    ┌──────────┼──────────┬──────────────┐
    ↓          ↓          ↓              ↓
┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐
│Composio│ │ Claude │ │DynamoDB│ │     S3       │
│ Bridge │ │ Sonnet │ │ (State)│ │  Artifacts   │
└────────┘ └────────┘ └────────┘ └──────────────┘
```

## Quick Start

```bash
# Clone and install
git clone https://github.com/diamitani/monarch-core.git
cd monarch-core
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your AWS credentials

# Start development server
pnpm dev

# Run tests
pnpm test
```

## Packages

| Package | Description |
|---------|-------------|
| `@monarch/shared` | Types, utilities, constants |
| `@monarch/pal-compiler` | Intent → Agent Manifest compiler |
| `@monarch/agentcore-runtime` | Bedrock AgentCore SDK wrapper |
| `@monarch/composio-bridge` | Third-party integrations (Google, Slack, etc.) |
| `@monarch/api` | HTTP API server |

## API Endpoints

### Projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects` - List projects
- `GET /api/v1/projects/:id` - Get project
- `PATCH /api/v1/projects/:id` - Update project

### Chat
- `POST /api/v1/projects/:id/chat` - Send message (SSE streaming)
- `GET /api/v1/projects/:id/sessions` - List sessions
- `POST /api/v1/projects/:id/sessions/:sid/end` - End session

### Integrations
- `GET /api/v1/integrations` - List connected integrations
- `POST /api/v1/integrations/connect` - Get OAuth URL
- `DELETE /api/v1/integrations/:id` - Revoke integration

## ROSTR Framework

Monarch Core implements the ROSTR architecture:

- **PAL** (Prompt Abstraction Layer): Compiles user intent into agent manifests
- **NPAO** (Navigate, Prioritize, Allocate, Orchestrate): Phase-aware task routing
- **RAG DAL**: Multi-tier knowledge retrieval
- **Rostr Hub**: Persistent reference architecture

### 5D Phase Taxonomy

| Phase | Description | Primary Agents |
|-------|-------------|----------------|
| PreD | Research, feasibility | Researcher |
| Design | Architecture, specs | Planner, Writer |
| Develop | Implementation | Writer, Organizer |
| Deploy | Ship to production | Deployer |
| Debug | Fix issues | Debugger, Researcher |

## Development

```bash
# Build all packages
pnpm build

# Run tests with coverage
pnpm test -- --coverage

# Lint
pnpm lint

# Format
pnpm format
```

## Deployment

### AWS Infrastructure

```bash
cd infrastructure/terraform
terraform init
terraform plan -var-file=prod.tfvars
terraform apply
```

### Create Bedrock Agents

```bash
# Create researcher agent
aws bedrock-agent create-agent \
  --agent-name "Monarch-Researcher" \
  --agent-resource-role-arn arn:aws:iam::ACCOUNT:role/bedrock-agent-execution-role \
  --foundation-model anthropic.claude-sonnet-4-20250514-v1:0 \
  --instruction "You are a research specialist agent..."
```

## License

MIT © Patrick Diamitani
