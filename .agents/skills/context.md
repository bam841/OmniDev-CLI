# OmniDev CLI — Architecture & Context Rules

## 1. System Identity & Mission
OmniDev CLI is an autonomous, developer-first command-line assistant designed to accelerate the software engineering lifecycle. It coordinates three specialized AI agent roles:
1. **Planner Agent (`omnidev plan <task>` / `omnidev plan --ui <prompt>`):** Analyzes project structure, requirements, and constraints to generate a discrete, testable implementation roadmap saved in `.omnidev/plan.md`. When run with `--ui`, acts as an Open Relume sitemap engine generating `.omnidev/sitemap.json` with mapped component block IDs and copywriting props.
2. **Coder Agent (`omnidev code` / `omnidev code --ui`):** Reads `.omnidev/plan.md` and `.omnidev/sitemap.json`, implements tasks vertically one-by-one, creates/modifies files, and updates execution state in `.omnidev/state.json`. In `--ui` mode, generates production-ready React + Tailwind wireframe components and assembles page views.
3. **Reviewer Agent (`omnidev review`):** Examines working directory and staged changes via `git diff`, validates changes against acceptance criteria in the plan, and flags security vulnerabilities, performance regressions, and logic bugs in `.omnidev/review.md`.

---

## 2. Technology Stack & Standards
- **Runtime:** Node.js >= 20.x (ESM: `"type": "module"`).
- **Language:** TypeScript 5.x with strict type checking enabled (`strict: true`, `noImplicitAny: true`).
- **CLI Framework:** `commander` with `@commander-js/extra-typings`.
- **LLM Standardization:** Vercel AI SDK (`ai`) with official providers:
  - `@ai-sdk/openai`
  - `@ai-sdk/anthropic`
  - `@ai-sdk/google`
  - `ollama-ai-provider`
- **Configuration & Validation:** `zod` for parsing and validating both user configs (`~/.omnidev/config.json`) and agent output schemas.
- **Terminal UX:** `chalk` (styling), `ora` (spinners), `@clack/prompts` (interactive menus), and `boxen` (bordered status panels).
- **Context & Git:** `ignore` for `.gitignore` file filtering; child processes / `simple-git` for diff generation.
- **Build & Packaging:** `tsup` targeting Node 20 ESM, with bin entry pointing to `dist/index.js`.
- **Testing:** `vitest` for unit and integration testing.

---

## 3. Directory Layout Conventions
```
OmniDev-CLI/
├── .agents/
│   └── skills/
│       ├── context.md             # This file: core architectural memory
│       └── ui-blocks-index.json   # Open Relume/Tailwind component block registry
├── docs/
│   ├── adr/                       # Architectural Decision Records (ADR-001, ADR-002, ...)
│   └── PLAN.md                    # Step-by-step master execution plan
├── scripts/
│   └── setup-mcp.sh               # MCP environment setup and health check
├── src/
│   ├── index.ts                   # CLI entrypoint and Commander wiring
│   ├── commands/                  # Command handlers (plan, code, review, config)
│   │   ├── plan.ts
│   │   ├── code.ts
│   │   ├── review.ts
│   │   └── config.ts
│   ├── core/                      # Core domain engines
│   │   ├── config/                # ~/.omnidev/config.json loader & Zod schema
│   │   ├── key-manager/           # BYOK key pool, 429 rotation & cooldown tracker
│   │   ├── llm/                   # Vercel AI SDK client factory & provider abstraction
│   │   └── context/               # Directory mapper, .gitignore filtering, diff extractor
│   ├── agents/                    # Specialized agent definitions & prompts
│   │   ├── base.ts                # Base agent lifecycle interface
│   │   ├── planner.ts             # Planner agent prompt & markdown generator
│   │   ├── coder.ts               # Coder agent prompt, tool calling & file writer
│   │   └── reviewer.ts            # Reviewer agent prompt & diff auditor
│   └── utils/                     # Formatting, spinners, logger, and file helpers
│       ├── ui.ts
│       ├── fs.ts
│       └── errors.ts
├── tests/
│   ├── unit/                      # Fast unit tests for key-manager, context, config
│   └── integration/               # CLI end-to-end command tests with mocked LLM streams
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

---

## 4. Architectural Rules & Constraints

### Rule 1: Zero Uncontrolled Telemetry or Proxying
- OmniDev communicates **only** with the official LLM provider APIs (Google, OpenAI, Anthropic) or local Ollama endpoints directly from the user's PC via HTTPS.
- User API keys never leave the local machine, and no analytics or telemetry is sent to any intermediary server.

### Rule 2: Robust BYOK Key Management & 429 Cooldowns
- The `KeyManager` maintains an in-memory pool of keys per provider.
- When an HTTP `429` (Rate Limit) is received from a provider:
  1. The offending key is immediately marked with a 60-second cooldown timestamp.
  2. The `KeyManager` selects the next unblocked key in the pool and retries the request without crashing the user's session.
  3. If all keys for a provider are exhausted, the CLI surfaces a countdown spinner or attempts a configured fallback provider.

### Rule 3: File System Safety First
- The Coder agent must only write or modify files within the target workspace directory.
- Never modify files matching `.gitignore` patterns or sensitive files (`.env`, `.git/`, credentials).
- Before applying destructive edits, verify parent directories exist and create atomic backups or git checkpoints if appropriate.

### Rule 4: Clean State Handoff
- Agents do not maintain in-memory state across separate command invocations.
- All persistent handoff occurs via `.omnidev/` artifacts:
  - `plan` writes `.omnidev/plan.md` and initializes `.omnidev/state.json`.
  - `code` reads `.omnidev/plan.md`, marks completed tasks in `.omnidev/state.json`, and modifies codebase files.
  - `review` compares the working branch / diff against the criteria in `.omnidev/plan.md` and outputs `.omnidev/review.md`.
  - `plan --ui` outputs `.omnidev/sitemap.json` consumed by `code --ui` for zero-cost component assembly.

### Rule 5: Strict Schema Validation
- All inputs from `~/.omnidev/config.json` must be validated with Zod.
- If a config file is corrupt or missing required fields, OmniDev must not crash with an unhandled exception; it must display an actionable error message guiding the user to run `omnidev config`.

### Rule 6: Zero-Cost Open UI Architecture
- OmniDev provides students and developers with full sitemap, wireframe, and component generation at $0 cost.
- Do not introduce dependencies on paid Relume MCP or proprietary API endpoints. Use the local block index (`.agents/skills/ui-blocks-index.json`), open shadcn CLI registries, and standard Tailwind CSS primitives.
