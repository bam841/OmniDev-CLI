# OmniDev CLI 🤖⚡

> **Autonomous AI Multi-Agent CLI with BYOK Key Rotation, Smart Context Traversal & State Handoff.**

OmniDev CLI accelerates the software development lifecycle by coordinating three specialized AI agent roles directly from your terminal:
1. **Planner Agent (`omnidev plan`):** Scans repository architecture and creates an actionable, testable roadmap in `.omnidev/plan.md`.
2. **Coder Agent (`omnidev code`):** Autonomously implements tasks step-by-step and updates state in `.omnidev/state.json`.
3. **Reviewer Agent (`omnidev review`):** Audits `git diff` against plan criteria to detect security vulnerabilities, edge cases, and performance regressions in `.omnidev/review.md`.

---

## 🌟 Key Features

- **BYOK (Bring Your Own Key) Engine:** Connect directly to Google Gemini, OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet), or local Ollama instances.
- **Automatic HTTP 429 Rate-Limit Rotation:** Configure an array of API keys per provider. When rate limits hit, OmniDev places the exhausted key on an in-memory cooldown timestamp and rotates to the next key seamlessly without crashing your session.
- **100% Local Client Execution:** Filesystem traversal, git diff extraction, and code modifications happen strictly on your machine. API keys are stored locally at `~/.omnidev/config.json` and are never sent to third-party telemetry servers.
- **Project-Local State Handoff:** Human-readable artifacts stored in `.omnidev/` allow developers to review, edit, or reject plans before code execution.
- **Smart Context Engine:** Automatically ignores `node_modules`, `dist`, `.git`, and files matched by `.gitignore` to minimize token consumption.

---

## 🚀 Installation

### Global Install via npm or pnpm
```bash
npm install -g omnidev-cli
# or
pnpm add -g omnidev-cli
```

### Run Directly via npx
```bash
npx omnidev-cli --help
```

---

## ⚡ Quick Start

### 1. Configure Providers & API Keys
Configure your default provider and add API keys interactively:
```bash
omnidev config
```
Or set them via CLI arguments:
```bash
# Set default provider
omnidev config --set-provider gemini

# Add API keys to pool
omnidev config --add-key gemini AIzaSyYourKey1
omnidev config --add-key gemini AIzaSyYourKey2
omnidev config --add-key openai sk-proj-YourOpenAIKey

# Inspect configuration (API keys are automatically masked for privacy)
omnidev config --show
```
*Note: OmniDev also seamlessly falls back to standard environment variables: `GEMINI_API_KEY`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY`.*

---

### 2. Plan a Feature or Refactor
Invoke the Lead Architect agent to inspect your project structure and compose a plan:
```bash
omnidev plan "Add a health check endpoint and request logging middleware"
```
This generates `.omnidev/plan.md` with discrete, verifiable tasks and initializes `.omnidev/state.json`.

---

### 3. Implement Code
Run the Coder agent to implement tasks sequentially:
```bash
# Execute the next pending task
omnidev code

# Or execute a specific task step
omnidev code --step 1

# Or implement all remaining tasks continuously
omnidev code --all
```
The Coder agent creates and updates target files safely, marking completed tasks in `.omnidev/plan.md` (`- [x] Task 1:`).

---


---

### 🎨 Zero-Cost UI & Wireframe Generation (Open Relume Engine)

Designed for students and developers who want to generate complete Tailwind wireframes and component sitemaps at $0 cost without paying for Relume API or MCP subscriptions:

```bash
# 1. Generate UI Wireframe Plan & Component Sitemap (.omnidev/sitemap.json)
omnidev plan --ui "Build a clean landing page for a student campus event tracker"

# 2. Assemble React + Tailwind Wireframe Components and Page Layouts
omnidev code --ui
```

- **Open Component Catalog:** Maps pages to open-source wireframe sections (`navbar-01`, `hero-relume-01`, `features-grid-01`, `pricing-01`, `footer-01`) with strict TypeScript props.
- **Free-Tier Friendly:** Powered by zero-cost LLM tiers (Gemini 1.5/2.5 Flash, Groq, local Ollama) with automated BYOK key rotation.
- **Zero Lock-In:** Generates pure, editable React + TypeScript + Tailwind CSS code directly into your workspace.

### 4. Review Changes
Run the Reviewer agent to audit git modifications:
```bash
# Review all working directory and staged changes
omnidev review

# Or review staged changes only
omnidev review --staged
```
The Reviewer outputs a structured audit report with verdicts (`APPROVED` or `CHANGES REQUESTED`) and saves it to `.omnidev/review.md`.

---

## 🛠️ Configuration Schema (`~/.omnidev/config.json`)

```json
{
  "defaultProvider": "gemini",
  "providers": {
    "gemini": {
      "model": "gemini-1.5-pro-latest",
      "keys": [
        "AIzaSyKey1...",
        "AIzaSyKey2..."
      ]
    },
    "openai": {
      "model": "gpt-4o",
      "keys": []
    },
    "anthropic": {
      "model": "claude-3-5-sonnet-20241022",
      "keys": []
    },
    "ollama": {
      "model": "llama3",
      "baseUrl": "http://localhost:11434"
    }
  }
}
```

---

## 🏗️ Architecture & Development

```
OmniDev-CLI/
├── src/
│   ├── index.ts                   # CLI entrypoint & Commander wiring
│   ├── commands/                  # Subcommands (plan, code, review, config)
│   ├── core/
│   │   ├── config/                # ~/.omnidev/config.json Zod manager
│   │   ├── key-manager/           # BYOK key pool & in-memory 429 rotation
│   │   ├── llm/                   # Vercel AI SDK provider router
│   │   └── context/               # Git diff & .gitignore tree mapper
│   ├── agents/                    # Planner, Coder, and Reviewer agents
│   └── utils/                     # UI, formatting, errors, fs utilities
├── tests/                         # Unit & Integration Vitest test suite
├── docs/
│   ├── adr/                       # Architectural Decision Records
│   └── PLAN.md                    # Master execution plan
└── tasks/
    └── todo.md                    # Implementation task checklist
```

### Running Tests and Building
```bash
# Run unit and integration test suite
pnpm test

# Typecheck and build standalone executable
pnpm run build
```

---

## 📄 License
MIT © OmniDev Team
