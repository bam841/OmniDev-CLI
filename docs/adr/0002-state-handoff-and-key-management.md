# ADR-002: Project-Local State Handoff and BYOK Key Management

## Status
ACCEPTED

## Date
2026-10-15

## Context
OmniDev CLI orchestrates a multi-step workflow between specialized agents:
1. `omnidev plan <prompt>` generates architectural plans and task definitions.
2. `omnidev code` executes tasks sequentially, reading plan files and generating/modifying code.
3. `omnidev review` inspects `git diff` against plan criteria and flags security, performance, and correctness issues.

Additionally, users supply arrays of API keys in `~/.omnidev/config.json` for OpenAI, Anthropic, and Google Gemini to avoid rate-limit disruptions. We needed to establish:
1. How agent state and artifacts are shared across commands.
2. How API keys are resolved and rotated during HTTP `429 Too Many Requests` events.

---

## Decision

### 1. Project-Local Artifact Storage (`.omnidev/`)
- Agent state and intermediate outputs will be stored inside a local `.omnidev/` directory at the project root:
  - `.omnidev/plan.md`: The output of the `plan` agent, structured with task checklists.
  - `.omnidev/state.json`: Lightweight metadata (session ID, active phase, model used, completed task indexes).
  - `.omnidev/review.md`: The output of the `review` agent containing audit findings and suggestions.
- The `.omnidev/` directory will be automatically added to `.gitignore` if git is initialized.
- **Rationale:** Keeps state human-readable, directly editable by developers in their IDE, version-controllable if desired, and eliminates the need for an external or centralized database.

### 2. BYOK Key Pool and In-Memory Cooldown Rotation
- API keys will be resolved using a priority hierarchy:
  1. Key arrays defined in `~/.omnidev/config.json` (e.g., `openai: ["sk-1...", "sk-2..."]`).
  2. Standard environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`).
  3. Local Ollama host (`http://localhost:11434`) without requiring an API key.
- Key rotation strategy:
  - Keys are rotated in round-robin fashion from the configured pool.
  - When an HTTP `429 (Rate Limit)` error is caught, the active key is marked with an in-memory cooldown timestamp (e.g. 60 seconds).
  - The request is immediately retried with the next available key in the pool.
  - If all keys for a provider are exhausted/cooling down, OmniDev can either fall back to an alternate configured provider or display an informative countdown banner.
  - Cooldowns remain in-memory per CLI session, avoiding stale cache lockouts across reboots.

### 3. Execution Boundary & Data Flow (Local CLI vs. Cloud LLMs)
- **Local Client-Side Execution (User's Machine):**
  - OmniDev CLI runs 100% locally on the developer's machine as a Node.js binary.
  - File reading, `.gitignore` traversal, chunking, `git diff` extraction, and disk writing (`.omnidev/plan.md`, source code modifications) happen strictly on the local machine.
  - API keys stay stored locally in `~/.omnidev/config.json` and are never forwarded to any third-party server other than the designated LLM provider endpoint.
- **Remote Cloud Processing (LLM Provider Servers):**
  - Inference, reasoning, and token generation take place remotely on the cloud servers of the respective AI providers (Google Gemini, OpenAI, Anthropic) via direct HTTPS API calls.
  - **Exception:** If the user explicitly selects `ollama` as their provider, inference runs 100% locally on their own hardware. Otherwise, for all standard commercial models, model computation happens on the provider's cloud servers.

---

## Consequences
- **Positive:** Zero external daemon or database dependency. Developers can inspect, edit, or reject the generated `.omnidev/plan.md` before running `omnidev code`.
- **Positive:** Uninterrupted agent runs even when individual API keys hit tier rate limits.
- **Consideration:** Multiple terminal sessions running concurrently in the same project directory will share `.omnidev/plan.md`. This is intentional and aligns with standard git working directory semantics.
