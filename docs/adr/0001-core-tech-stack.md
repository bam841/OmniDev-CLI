# ADR-001: Core Technology Stack and Language Runtime for OmniDev CLI

## Status
ACCEPTED

## Date
2026-10-15

## Context
OmniDev CLI is an autonomous, developer-focused command-line interface that assists software engineers through structured agentic workflows: planning, coding, and code review. 

Key requirements from the project specification:
1. **Multi-Provider LLM Integration & BYOK (Bring Your Own Key):** Unified routing across OpenAI, Anthropic, Google Gemini, and local Ollama instances.
2. **Key Rotation & Fault Tolerance:** Automatic retry on HTTP `429 (Too Many Requests)` rate-limit errors by rotating through arrays of provider keys.
3. **Smart Context Engine:** Fast filesystem traversal respecting `.gitignore`, file chunking, git diff analysis, and low token overhead.
4. **Agent Roles & State Handoff:** Sequential orchestration (Planner -> Coder -> Reviewer) passing structured markdown/diff artifacts.
5. **Developer Experience & UI:** Polished terminal UI with spinners, status badges, syntax highlighting, and responsive interactive prompts.
6. **Zero-Friction Distribution:** Effortless installation for developers across macOS, Linux, and Windows via `npm` or `pnpm`.

Following architectural review and user direction, the project will be built using the **TypeScript / Node.js** ecosystem.

---

## Decision
We adopt **TypeScript (Node.js 20+)** as the primary language and runtime for OmniDev CLI:

- **Language & Runtime:** TypeScript targeting Node.js >= 20.x (ESM modules).
- **CLI Framework:** [`commander`](https://github.com/tj/commander.js) with `@commander-js/extra-typings` for type-safe arguments and option parsing.
- **LLM Standardization & Providers:** [Vercel AI SDK (`ai`)](https://sdk.vercel.ai/) with official provider packages:
  - `@ai-sdk/openai`
  - `@ai-sdk/anthropic`
  - `@ai-sdk/google`
  - `ollama-ai-provider`
- **BYOK Key Pool & Rate-Limit Manager:** Custom `KeyManager` adapter wrapping Vercel AI SDK model instances to handle key rotation, in-memory cooldown tracking on `429` responses, and model fallback.
- **Terminal UI & Styling:** 
  - [`chalk`](https://github.com/chalk/chalk) for color palettes and styling.
  - [`ora`](https://github.com/sindresorhus/ora) for CLI spinners.
  - [`@clack/prompts`](https://github.com/natemoo-re/clack) for modern interactive prompts and menus.
  - [`boxen`](https://github.com/sindresorhus/boxen) for demarcating agent output panels.
- **Schema Validation:** [`zod`](https://github.com/colinhacks/zod) for parsing and validating `~/.omnidev/config.json` and agent state schemas.
- **Context & Git Utilities:** `ignore` for `.gitignore` pattern matching and `simple-git` (or Node `child_process`) for retrieving staged and working directory diffs.
- **Build & Packaging:** [`tsup`](https://tsup.egoist.dev/) for high-speed zero-config bundling to standalone ESM/CJS executables, with package management via `pnpm` / `npm`.
- **Testing:** [`vitest`](https://vitest.dev/) for fast unit and integration testing with native mock support.

---

## Alternatives Considered

### Option 1: Python (Typer + LiteLLM + Rich + Pydantic)
- **Evaluation:** Python offers in-process `LiteLLM` with built-in multi-provider fallback.
- **Reason for Rejection:** The team chose TypeScript/Node.js to ensure seamless npm/npx distribution (`npx omnidev`), zero Python environment setup for web and full-stack developers, and native async stream ergonomics.

### Option 2: Go (Cobra + Charm/Bubbletea)
- **Evaluation:** Single static binary with near-instant cold start.
- **Reason for Rejection:** High development overhead for custom multi-provider LLM integrations and key rotation logic; lower ecosystem velocity for prompt engineering compared to TypeScript/Node.js.

---

## Consequences

### Positive
1. **Frictionless Developer Adoption:** Global install via `npm i -g omnidev` or ephemeral execution via `npx omnidev` requires no Python or virtual environment management.
2. **First-Class Async Streaming:** Vercel AI SDK provides standard Web Streams and unified response handling across all major providers.
3. **Type Safety Across Boundaries:** Strict `zod` schemas ensure configuration, LLM parameters, and agent outputs are validated at runtime with end-to-end TypeScript types.
4. **Fast Build & Test Loop:** `tsup` and `vitest` provide sub-second build and test iterations.

### Challenges & Mitigations
1. **Custom Key Rotation Logic:** Unlike Python's `LiteLLM` which bundles internal router rotation, the Vercel AI SDK requires OmniDev to implement a clean `KeyManager` wrapper that intercepts 429s and rotates provider instances.
   - *Mitigation:* We will implement a dedicated `KeyManager` module in Phase 2 that pools keys per provider, checks rate-limit timestamps, and retries requests transparently.
2. **Node.js Startup Overhead:**
   - *Mitigation:* Bundle CLI commands cleanly with `tsup` and dynamically import heavy provider libraries only when executing specific commands.
