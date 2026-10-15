# OmniDev CLI — Task Checklist

## Phase 1: Foundation, Scaffolding & Configuration Management
- [ ] Task 1.1: Project Initialization & Build Scaffolding (`package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`)
- [ ] Task 1.2: Zod Configuration Schema & Config Manager (`src/core/config/`)
- [ ] Task 1.3: CLI Command Scaffolding & Interactive Config Command (`src/commands/config.ts`, `src/index.ts`)
- [ ] **Checkpoint: Foundation Complete** (Verify build & unit tests)

## Phase 2: BYOK Engine & LLM Provider Router
- [ ] Task 2.1: KeyManager & 429 Rate-Limit Cooldown Logic (`src/core/key-manager/`)
- [ ] Task 2.2: Vercel AI SDK Client Factory & Unified Provider Router (`src/core/llm/`)
- [ ] **Checkpoint: LLM Router & Key Engine Verified** (Verify round-robin rotation & 429 retries)

## Phase 3: Smart Context Engine & State Handoff
- [ ] Task 3.1: Repository Tree Mapper & Ignore Engine (`src/core/context/tree.ts`)
- [ ] Task 3.2: Git Diff & Working Tree Extractor (`src/core/context/git.ts`)
- [ ] Task 3.3: Project-Local State Store (`.omnidev/` management)
- [ ] **Checkpoint: Context & State Handoff Verified** (Verify tree filtering, git diff, .omnidev artifacts)

## Phase 4: Agent Implementations
- [ ] Task 4.1: Planner Agent & `omnidev plan` (`src/agents/planner.ts`, `src/commands/plan.ts`)
- [ ] Task 4.2: Coder Agent & `omnidev code` (`src/agents/coder.ts`, `src/commands/code.ts`)
- [ ] Task 4.3: Reviewer Agent & `omnidev review` (`src/agents/reviewer.ts`, `src/commands/review.ts`)
- [ ] **Checkpoint: Multi-Agent Pipeline Operational** (Verify plan -> code -> review end-to-end)

## Phase 5: Hardening, Polish & Distribution
- [ ] Task 5.1: Error Handling, Resiliency & Offline Edge Cases (`src/utils/errors.ts`)
- [ ] Task 5.2: Documentation, README & Distribution Packaging (`README.md`, `npm pack`)
- [ ] **Checkpoint: Release Ready** (Clean build, all tests pass, zero vulnerabilities)
