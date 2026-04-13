# 🐝 Hive — Multi-Agent Orchestration Platform

**OpenClaw + Supabase + GitHub + Anthropic API**

Hive is a self-evolving multi-agent system where a privileged **Secretary** agent creates, modifies, and manages specialized **Drone** agents to accomplish tasks. Every agent mutation is tracked in Supabase and version-controlled in GitHub.

## Architecture

```
Hive UI (GitHub Pages)  ←→  Supabase (state, realtime)  ←→  Anthropic API (Sonnet/Opus)
                                    ↕                              ↕
                              GitHub (versioning)          OpenClaw (channels)
```

## Key Concepts

- **Secretary** — The master orchestrator. Only agent with permission to create/modify other agents.
- **Drones** — Specialized agents created by Secretary for specific task types.
- **Reinforcement Loop** — Tasks go through attempt → evaluate → feedback → retry cycles.
- **Mutation Log** — Every change to any agent is audited with reasons and GitHub commits.

## Project Structure

```
hive-core/
├── agents/          # Agent definitions (SOUL.md, tools.json)
├── supabase/        # Database migrations, seed data, Edge Functions
├── ui/              # React dashboard (deployed to GitHub Pages)
├── scripts/         # Sync and setup utilities
└── docs/            # Documentation and guides
```

## Setup

See [docs/PHASE-0-GUIDE.md](docs/PHASE-0-GUIDE.md) for step-by-step instructions.

## Status

🚧 Phase 0 — Infrastructure setup
