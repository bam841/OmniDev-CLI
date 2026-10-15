# OmniDev CLI — Master Execution Plan

## 1. Project Overview
OmniDev CLI is an autonomous, developer-first command-line assistant built with TypeScript, Node.js, Commander.js, and the Vercel AI SDK. It orchestrates three specialized agents (`plan`, `code`, `review`) through project-local artifacts in `.omnidev/` and features a Bring-Your-Own-Key (BYOK) engine with automatic HTTP 429 rate-limit rotation across Google Gemini, OpenAI, Anthropic, and local Ollama instances.

- **Stack:** TypeScript, Node.js 20+, Commander, Vercel AI SDK (`ai`), Zod, Chalk, Ora, Vitest, tsup.
- **Reference ADRs:** [ADR-001: Core Tech Stack](file:///home/bamz/Documents/vs_code/OmniDev-CLI/docs/adr/0001-core-tech-stack.md), [ADR-002: State Handoff & Key Management](file:///home/bamz/Documents/vs_code/OmniDev-CLI/docs/adr/0002-state-handoff-and-key-management.md).
- **Core Rules:** See [.agents/skills/context.md](file:///home/bamz/Documents/vs_code/OmniDev-CLI/.agents/skills/context.md).

---

## 2. Dependency Graph

```
Phase 1: Project Scaffolding & Configuration Manager
  │
  ├── Phase 2: BYOK Engine & Multi-Provider LLM Router
  │     │
  │     └── Phase 3: Smart Context Engine (Git Diff, Tree Mapper, State)
  │           │
  │           └── Phase 4: Agent Implementations (Planner, Coder, Reviewer)
  │                 │
  │                 └── Phase 5: End-to-End Integration, CLI UX & Packaging
```

---

## 3. Step-by-Step Task Breakdown

### Phase 1: Foundation, Scaffolding & Configuration Management

#### Task 1.1: Project Initialization & Build Scaffolding
- **Description:** Initialize `package.json`, configure TypeScript (`tsconfig.json`), `tsup.config.ts`, `vitest.config.ts`, and directory structure (`src/`, `tests/`).
- **Acceptance Criteria:**
  - `pnpm/npm install` completes cleanly with core dev dependencies (`typescript`, `tsup`, `vitest`, `@types/node`).
  - `npm run build` compiles `src/index.ts` to `dist/index.js` with shebang (`#!/usr/bin/env node`).
  - `npm test` runs Vitest successfully.
- **Verification:**
  - `npm run build && node dist/index.js --version`
  - `npm test`
- **Files:** `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `src/index.ts`
- **Dependencies:** None
- **Scope:** Small (3-5 files)

#### Task 1.2: Zod Configuration Schema & Config Manager
- **Description:** Implement `src/core/config/schema.ts` and `src/core/config/manager.ts` to read, validate, write, and ensure defaults for `~/.omnidev/config.json`.
- **Acceptance Criteria:**
  - Validates provider configurations (Gemini, OpenAI, Anthropic, Ollama) and key arrays.
  - Automatically creates `~/.omnidev/` and writes default template if file does not exist.
  - Gracefully reports actionable errors on corrupt JSON or missing fields without throwing unhandled exceptions.
- **Verification:**
  - `npm test tests/unit/config.test.ts`
- **Files:** `src/core/config/schema.ts`, `src/core/config/manager.ts`, `tests/unit/config.test.ts`
- **Dependencies:** Task 1.1
- **Scope:** Small (3 files)

#### Task 1.3: CLI Command Scaffolding & Interactive Config Command
- **Description:** Implement base Commander CLI structure in `src/index.ts` with subcommands: `config`, `plan`, `code`, `review`. Implement interactive `omnidev config` using `@clack/prompts` to set default provider and input API keys.
- **Acceptance Criteria:**
  - `omnidev --help` displays all subcommands and flags.
  - `omnidev config` allows selecting default provider and setting API keys interactively.
  - `omnidev config --show` prints active configuration with masked API keys.
- **Verification:**
  - `npm run build`
  - `node dist/index.js config --help`
  - `npm test tests/unit/cli-commands.test.ts`
- **Files:** `src/index.ts`, `src/commands/config.ts`, `src/utils/ui.ts`, `tests/unit/cli-commands.test.ts`
- **Dependencies:** Task 1.2
- **Scope:** Medium (4 files)

---

### Checkpoint: Foundation Complete
- [ ] All unit tests pass: `npm test`
- [ ] Build succeeds without TypeScript errors: `npm run build`
- [ ] `node dist/index.js config` runs and validates config files.

---

### Phase 2: BYOK Engine & LLM Provider Router

#### Task 2.1: KeyManager & 429 Rate-Limit Cooldown Logic
- **Description:** Implement `src/core/key-manager/index.ts` to manage key pools, rotate keys in round-robin sequence, track per-key cooldown timestamps upon HTTP 429 errors, and fall back to environment variables.
- **Acceptance Criteria:**
  - `getNextKey(provider)` returns the next available unblocked key.
  - `markRateLimited(provider, key, durationSeconds)` places the key on temporary cooldown.
  - Exhaustion of all keys triggers a descriptive error or triggers fallback provider logic.
- **Verification:**
  - `npm test tests/unit/key-manager.test.ts`
- **Files:** `src/core/key-manager/index.ts`, `src/core/key-manager/types.ts`, `tests/unit/key-manager.test.ts`
- **Dependencies:** Task 1.2
- **Scope:** Small (3 files)

#### Task 2.2: Vercel AI SDK Client Factory & Unified Provider Router
- **Description:** Implement `src/core/llm/router.ts` creating model instances for OpenAI, Anthropic, Gemini, and Ollama. Wrap model calls with automatic 429 interception and key rotation.
- **Acceptance Criteria:**
  - Factory dynamically instantiates `@ai-sdk/google`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, or `ollama-ai-provider`.
  - Automatic retry intercepts rate limits, rotates keys via `KeyManager`, and retries up to 3 times before failing.
  - Streaming and non-streaming text generation methods exposed via a clean, unified interface.
- **Verification:**
  - `npm test tests/unit/llm-router.test.ts`
- **Files:** `src/core/llm/router.ts`, `src/core/llm/providers.ts`, `tests/unit/llm-router.test.ts`
- **Dependencies:** Task 2.1
- **Scope:** Medium (3-4 files)

---

### Checkpoint: LLM Router & Key Engine Verified
- [ ] Vitest mocks verify round-robin key cycling on simulated 429 errors.
- [ ] Provider factory returns correct model instances for each supported provider.

---

### Phase 3: Smart Context Engine & State Handoff

#### Task 3.1: Repository Tree Mapper & Ignore Engine
- **Description:** Implement `src/core/context/tree.ts` to scan workspace directories, respecting `.gitignore` and default excludes (`node_modules`, `.git`, `dist`, binaries), generating a lightweight token-efficient directory tree.
- **Acceptance Criteria:**
  - Traverses directory recursively up to configurable depth.
  - Excludes all patterns listed in `.gitignore` using the `ignore` library.
  - Returns a clean ASCII tree representation and file list under 2,000 tokens for average codebases.
- **Verification:**
  - `npm test tests/unit/tree-mapper.test.ts`
- **Files:** `src/core/context/tree.ts`, `tests/unit/tree-mapper.test.ts`
- **Dependencies:** Task 1.1
- **Scope:** Small (2 files)

#### Task 3.2: Git Diff & Working Tree Extractor
- **Description:** Implement `src/core/context/git.ts` to retrieve staged and unstaged `git diff` output, changed file lists, and recent commit summaries for the Reviewer agent.
- **Acceptance Criteria:**
  - Runs `git diff HEAD` or staged diff cleanly via child process.
  - Gracefully handles non-git repositories with an informative message.
  - Truncates oversized diffs with token warnings.
- **Verification:**
  - `npm test tests/unit/git-context.test.ts`
- **Files:** `src/core/context/git.ts`, `tests/unit/git-context.test.ts`
- **Dependencies:** Task 1.1
- **Scope:** Small (2 files)

#### Task 3.3: Project-Local State Store (`.omnidev/`)
- **Description:** Implement `src/core/context/state.ts` to initialize `.omnidev/`, manage `.omnidev/plan.md`, `.omnidev/state.json`, and `.omnidev/review.md`, and auto-append `.omnidev` to `.gitignore`.
- **Acceptance Criteria:**
  - Creates `.omnidev/` directory safely if missing.
  - Serializes and deserializes `.omnidev/state.json` (active step index, task status, timestamp).
  - Automatically ensures `.omnidev` is present in `.gitignore`.
- **Verification:**
  - `npm test tests/unit/state-store.test.ts`
- **Files:** `src/core/context/state.ts`, `tests/unit/state-store.test.ts`
- **Dependencies:** Task 1.2
- **Scope:** Small (2 files)

---

### Checkpoint: Context & State Handoff Verified
- [ ] Tree mapper accurately ignores gitignored files and directories.
- [ ] Git diff extraction works in real git repositories.
- [ ] `.omnidev/` artifacts read and write with strict schema checks.

---

### Phase 4: Agent Implementations

#### Task 4.1: Planner Agent & `omnidev plan`
- **Description:** Implement `src/agents/planner.ts` and `src/commands/plan.ts`. Gathers workspace directory map, system requirements, and user prompt; invokes the LLM with the Planner system prompt; renders live streaming output and writes `.omnidev/plan.md`.
- **Acceptance Criteria:**
  - Generates structured markdown plan with discrete tasks and verification commands.
  - Displays interactive spinner/streaming tokens using `ora` and `chalk`.
  - Saves result to `.omnidev/plan.md` and initializes `.omnidev/state.json`.
- **Verification:**
  - `npm test tests/integration/planner.test.ts`
  - `node dist/index.js plan "Add health check endpoint" --dry-run`
- **Files:** `src/agents/planner.ts`, `src/commands/plan.ts`, `tests/integration/planner.test.ts`
- **Dependencies:** Tasks 2.2, 3.1, 3.3
- **Scope:** Medium (3 files)

#### Task 4.2: Coder Agent & `omnidev code`
- **Description:** Implement `src/agents/coder.ts` and `src/commands/code.ts`. Reads `.omnidev/plan.md`, identifies next pending task, inspects referenced files, prompts LLM for precise code changes, applies file modifications safely, and updates `.omnidev/state.json`.
- **Acceptance Criteria:**
  - Parses current task checklist item from `.omnidev/plan.md`.
  - Modifies or creates target files safely without deleting unrelated content.
  - Updates task status in `.omnidev/state.json` upon completion.
  - Supports `--step` (execute single step) and `--all` (execute all steps).
- **Verification:**
  - `npm test tests/integration/coder.test.ts`
- **Files:** `src/agents/coder.ts`, `src/commands/code.ts`, `src/utils/fs.ts`, `tests/integration/coder.test.ts`
- **Dependencies:** Tasks 2.2, 3.1, 3.3, 4.1
- **Scope:** Medium (4 files)

#### Task 4.3: Reviewer Agent & `omnidev review`
- **Description:** Implement `src/agents/reviewer.ts` and `src/commands/review.ts`. Extracts `git diff` against plan criteria, audits code for security vulnerabilities, edge cases, and performance regressions, and generates `.omnidev/review.md`.
- **Acceptance Criteria:**
  - Analyzes active `git diff` against acceptance criteria in `.omnidev/plan.md`.
  - Categorizes findings (Critical, Warning, Improvement).
  - Displays summary boxen table in terminal and outputs `.omnidev/review.md`.
- **Verification:**
  - `npm test tests/integration/reviewer.test.ts`
- **Files:** `src/agents/reviewer.ts`, `src/commands/review.ts`, `tests/integration/reviewer.test.ts`
- **Dependencies:** Tasks 2.2, 3.2, 3.3, 4.1
- **Scope:** Medium (3 files)

---

### Checkpoint: Full Multi-Agent Pipeline Operational
- [ ] `plan` creates `.omnidev/plan.md`
- [ ] `code` executes tasks and updates `.omnidev/state.json`
- [ ] `review` audits `git diff` and outputs `.omnidev/review.md`

---

### Phase 5: Hardening, Polish & Distribution

#### Task 5.1: Error Handling, Resiliency & Offline Edge Cases
- **Description:** Implement network outage handling, missing API key hints, corrupted file recovery, and Ctrl+C SIGINT graceful cleanup in `src/utils/errors.ts`.
- **Acceptance Criteria:**
  - Clean exit without raw stack trace dump when user cancels with Ctrl+C.
  - Informative diagnostic message when no keys are configured.
  - Offline / DNS failure displays offline guidance.
- **Verification:**
  - `npm test tests/unit/errors.test.ts`
- **Files:** `src/utils/errors.ts`, `tests/unit/errors.test.ts`
- **Dependencies:** Tasks 4.1, 4.2, 4.3
- **Scope:** Small (2 files)

#### Task 5.2: Documentation, README & Distribution Packaging
- **Description:** Finalize `README.md` with installation guides (`npm install -g omnidev`), quick start walkthrough, configuration guide, and prepare `package.json` for npm publishing.
- **Acceptance Criteria:**
  - Comprehensive `README.md` with code examples and screenshots/ascii art.
  - `package.json` includes `bin`, `files`, `repository`, and `keywords`.
  - `npm run prepublishOnly` builds and runs all tests.
- **Verification:**
  - `npm pack --dry-run`
  - `npm test`
- **Files:** `README.md`, `package.json`
- **Dependencies:** Task 5.1
- **Scope:** Small (2 files)

---

## 4. Risks and Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Frequent 429 Rate Limits on free tiers** | High | Automatic in-memory key rotation + 60s cooldown timestamp + multi-key array support. |
| **Hallucinated file paths by Coder agent** | Medium | Context engine validates file paths against repository tree before applying edits; prevents writes outside project root. |
| **Large token consumption on huge repos** | High | Tree mapper limits depth, respects `.gitignore`, and truncates large files into outline summaries. |
| **Unformatted terminal output across OSs** | Low | Standardized terminal rendering using `chalk`, `ora`, and `@clack/prompts` tested on Linux/macOS/Windows. |
