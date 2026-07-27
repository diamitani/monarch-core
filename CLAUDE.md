# Monarch Core - ROSTR Implementation

This codebase implements the ROSTR framework for production-grade multi-agent systems.

## Key Principles

1. **All agent invocations flow through PAL compilation** - Never use raw prompts
2. **Phase classification precedes allocation** - Determine workflow stage before routing
3. **Knowledge retrieval uses hierarchical credibility** - Not all sources are equal
4. **State updates persist to reference hub** - Enable knowledge compounding

## Project Structure

```
monarch-core/
├── packages/
│   ├── shared/           # Types, utilities, constants
│   ├── pal-compiler/     # Intent → Manifest compilation
│   ├── agentcore-runtime/# Bedrock SDK wrapper
│   ├── composio-bridge/  # Third-party integrations
│   └── api/              # HTTP server
├── infrastructure/
│   └── terraform/        # AWS infrastructure
└── docs/
```

## Development Commands

```bash
pnpm install    # Install dependencies
pnpm build      # Build all packages
pnpm dev        # Start dev server
pnpm test       # Run tests
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- `AWS_REGION` - AWS region (default: us-east-1)
- `COMPOSIO_API_KEY` - For third-party integrations
- `PORT` - API server port (default: 8080)

## Agent Routing

The PAL compiler routes requests based on domain and phase:

| Domain | Phase | Agent |
|--------|-------|-------|
| research | pred | researcher |
| design | design | planner |
| code | develop | writer |
| content | develop | writer |
| ops | deploy | deployer |
| debug | debug | debugger |
