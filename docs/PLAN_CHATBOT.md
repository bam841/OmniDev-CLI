# OmniDev Chatbot — Master Execution Plan

> **Transforming OmniDev CLI into an Interactive Conversational AI Assistant with Multi-Provider BYOK Key Management.**

---

## 1. Executive Summary & Goal

OmniDev CLI currently operates as a task-driven multi-agent tool (`omnidev plan`, `omnidev code`, `omnidev review`). While its underlying Bring-Your-Own-Key (BYOK) architecture robustly manages key pools and HTTP 429 rate-limit cooldowns across **Google Gemini**, **OpenAI**, **Anthropic**, and **Ollama**, users are currently forced directly into autonomous code planning rather than having a natural conversational interface.

### The Objective
Make OmniDev a flexible, interactive AI chatbot where developers can:
1. **Chat Naturally with Any Configured LLM:** Converse directly with models (e.g. Gemini 1.5/2.0, Claude 3.5 Sonnet, GPT-4o, Llama 3) via an interactive terminal REPL using their own API keys.
2. **Dynamic Multi-Turn Context:** Retain conversation history with sliding-window token management and local session persistence.
3. **Mid-Conversation Control via Slash Commands:** Switch providers (`/provider`), switch models (`/model`), check key health (`/keys`), clear context (`/clear`), or inject workspace code files (`/context <path>`).
4. **Seamless Escalation to Autonomous Agents:** Brainstorm or debug inside chat, and when ready, trigger autonomous planning (`/plan`) or coding (`/code`) using the accumulated chat context.
5. **Frictionless Entry Point:** Launching bare `omnidev` defaults to the interactive chatbot experience rather than a static `--help` screen.

---

## 2. Architecture & Design

```
                     ┌──────────────────────────────────────────────┐
                     │           Terminal User Interaction          │
                     │          (omnidev or omnidev chat)           │
                     └──────────────────────┬───────────────────────┘
                                            │
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │          Interactive Chat REPL Loop          │
                     │        (src/chat/repl.ts & ui.ts)            │
                     └──────┬───────────────────────────────┬───────┘
                            │                               │
                 Slash Command (/provider,                  │ Natural Message
                 /model, /clear, /context)                  │
                            │                               ▼
                            ▼               ┌───────────────────────────────┐
             ┌───────────────────────────┐  │      Chat Session Store       │
             │   Chat Command Dispatcher │  │      (src/chat/session.ts)    │
             │   (src/chat/commands.ts)  │  │  - CoreMessage[] history      │
             └──────────────┬────────────┘  │  - Sliding window management  │
                            │               │  - Session export / import    │
                            │               └───────────────┬───────────────┘
                            │                               │
                            ▼                               ▼
                     ┌──────────────────────────────────────────────┐
                     │            Enhanced LLM Router               │
                     │         (src/core/llm/router.ts)             │
                     │  - CoreMessage[] multi-turn support          │
                     │  - Chunk-by-chunk token streaming            │
                     └──────────────────────┬───────────────────────┘
                                            │
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │           BYOK Key Manager Engine            │
                     │       (src/core/key-manager/index.ts)        │
                     │  - Round-robin key pool rotation             │
                     │  - HTTP 429 rate-limit cooldown tracking     │
                     └──────────────────────┬───────────────────────┘
                                            │
             ┌──────────────┬───────────────┼───────────────┬──────────────┐
             ▼              ▼               ▼               ▼              ▼
       Google Gemini     OpenAI         Anthropic        Ollama       Future LLMs
```

---

## 3. Dependency Graph & Phases

```
Phase 1: LLM Router Multi-Turn Message Expansion
  │
  ├── Phase 2: Chat Session Store & History Management
  │     │
  │     └── Phase 3: Interactive REPL Loop & In-Chat Commands
  │           │
  │           └── Phase 4: CLI Scaffolding (`omnidev chat` & Bare Invocation)
  │                 │
  │                 └── Phase 5: Verification, Unit Testing & Documentation
```

---

## 4. Step-by-Step Task Breakdown

### Phase 1: LLM Router Multi-Turn Enhancement

#### Task 1.1: Expand `LLMRouter` to Support `CoreMessage[]`
- **Description:** Currently, `src/core/llm/router.ts` only accepts a single `prompt: string` and optional `system: string`. Extend `LLMRequestOptions` and `LLMStreamOptions` to support `messages?: CoreMessage[]` from the Vercel AI SDK (`ai`).
- **Implementation Details:**
  - Update `LLMRequestOptions` interface to accept `messages?: CoreMessage[]`.
  - When `messages` is provided, pass `messages` directly to `generateText` and `streamText`.
  - Maintain backward compatibility: if `prompt` is provided without `messages`, construct a single user message or pass `prompt`.
  - Ensure `executeWithRotation` handles rate limits (429) identically during multi-turn streaming.
- **Files:** `src/core/llm/router.ts`, `tests/unit/llm-router.test.ts`
- **Dependencies:** None

---

### Phase 2: Chat Session Store & Context Management

#### Task 2.1: Implement `ChatSession` Store
- **Description:** Create `src/chat/session.ts` to manage in-memory conversation state, token estimation, and message history.
- **Implementation Details:**
  - Track messages using Vercel AI SDK's `CoreMessage` format (`system`, `user`, `assistant`).
  - Configure default system prompt: *"You are OmniDev, an expert software engineering assistant. You assist with code design, architectural questions, debugging, and terminal operations."*
  - Implement sliding-window pruning: when total messages exceed threshold (e.g., 40 turns), compress or trim early turns while preserving the system prompt.
  - Provide helper methods: `addUserMessage(content)`, `addAssistantMessage(content)`, `getMessages()`, `clear()`, `exportSession()`.
- **Files:** `src/chat/session.ts`, `src/chat/types.ts`, `tests/unit/chat-session.test.ts`
- **Dependencies:** Task 1.1

---

### Phase 3: Interactive REPL & Slash Commands

#### Task 3.1: In-Chat Command Dispatcher
- **Description:** Implement `src/chat/commands.ts` to intercept user inputs starting with `/` inside the chat loop.
- **Supported Slash Commands:**
  - `/help`: Display available chat commands and shortcuts.
  - `/provider <name>`: Switch active LLM provider (`gemini`, `openai`, `anthropic`, `ollama`) on the fly.
  - `/model <name>`: Switch the active model for the current provider.
  - `/keys`: Display key status, count, and active cooldowns from `KeyManager`.
  - `/clear`: Reset conversation history.
  - `/context <file|dir>`: Read a local file or directory structure and inject it into conversation context.
  - `/plan [prompt]`: Directly transition into the Planner agent using the current chat context.
  - `/save [path]`: Export the current conversation transcript as Markdown.
  - `/exit` or `/quit`: Terminate the REPL cleanly.
- **Files:** `src/chat/commands.ts`, `tests/unit/chat-commands.test.ts`
- **Dependencies:** Task 2.1

#### Task 3.2: Terminal REPL Loop & Live Stream Renderer
- **Description:** Implement `src/chat/repl.ts` providing an interactive terminal loop.
- **Implementation Details:**
  - Interactive prompt using Node.js `readline/promises` or `@clack/prompts` with clean prompt formatting (`omnidev > `).
  - Stream LLM responses chunk-by-chunk to `process.stdout` with syntax highlighting / formatted text.
  - Handle `SIGINT` (Ctrl+C) to cancel active streaming without exiting the entire session; double Ctrl+C or `/exit` exits the REPL.
  - Display helpful status badges showing active provider and model (e.g. `[gemini: gemini-1.5-flash]`).
- **Files:** `src/chat/repl.ts`, `src/utils/ui.ts`
- **Dependencies:** Task 3.1

---

### Phase 4: CLI Scaffolding & Default Entry Point

#### Task 4.1: Register `omnidev chat` Command
- **Description:** Implement `src/commands/chat.ts` using Commander.js and register it in `src/index.ts`.
- **CLI Options:**
  - `omnidev chat` (starts REPL)
  - `-p, --provider <provider>`: Initial provider override.
  - `-m, --model <model>`: Initial model override.
  - `-s, --system <prompt>`: Custom system prompt override.
  - `-c, --context <files...>`: Pre-load files into conversation context on startup.
- **Files:** `src/commands/chat.ts`, `src/index.ts`
- **Dependencies:** Task 3.2

#### Task 4.2: Default Bare Invocation to Chat Mode
- **Description:** Update `src/index.ts` so running `omnidev` without subcommands or flags automatically launches the interactive chat REPL rather than only showing `--help`.
- **Files:** `src/index.ts`
- **Dependencies:** Task 4.1

---

### Phase 5: Verification, Testing & Documentation

#### Task 5.1: Unit & Integration Test Suite
- **Description:** Add unit tests covering multi-turn message handling, session management, slash command execution, and rate-limit recovery during chat.
- **Files:** `tests/unit/chat-session.test.ts`, `tests/unit/chat-commands.test.ts`, `tests/unit/llm-router.test.ts`
- **Verification:** Run `npm test` and ensure all test suites pass.

#### Task 5.2: User Documentation & README Update
- **Description:** Update `README.md` and `docs/` with quick-start instructions for interactive chat, list of slash commands, and examples of multi-provider BYOK chatting.
- **Files:** `README.md`

---

## 5. Verification Plan

### Automated Tests
```bash
# Typecheck
npm run typecheck

# Unit tests
npm test

# Build validation
npm run build
```

### Manual Verification Flow
1. **Interactive Chat Launch:**
   ```bash
   node dist/index.js chat
   ```
2. **Provider Switching:**
   In chat: `/provider openai` -> verify model switch prompt or defaults.
3. **Multi-Turn Continuity:**
   User: *"Remember the secret word: ALBATROSS."*
   User: *"What was the secret word?"*
   Verify assistant responds with *"ALBATROSS"*.
4. **Context Injection:**
   In chat: `/context package.json` -> ask *"What dependencies are installed?"*.
5. **Agent Handoff:**
   In chat: `/plan Build a healthcheck route` -> verify trigger into `runPlanner()`.
