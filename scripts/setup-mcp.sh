#!/usr/bin/env bash
# ==============================================================================
# OmniDev CLI — MCP & Developer Environment Setup Script
# ==============================================================================
set -euo pipefail

echo "=================================================="
echo "  OmniDev CLI — Environment & MCP Setup Check"
echo "=================================================="

# 1. Verify Node.js version (>= 20 required)
echo "[1/5] Checking Node.js environment..."
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js 20+."
    exit 1
fi

NODE_MAJOR=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "❌ Warning: Node.js version $(node -v) detected. Node 20+ is strongly recommended."
else
    echo "✅ Node.js $(node -v) detected (compatible)."
fi

# 2. Check Package Manager (npm / pnpm)
echo "[2/5] Checking package manager..."
if command -v pnpm &> /dev/null; then
    PKG_MGR="pnpm"
    echo "✅ pnpm detected ($(pnpm -v))."
elif command -v npm &> /dev/null; then
    PKG_MGR="npm"
    echo "✅ npm detected ($(npm -v))."
else
    echo "❌ Error: Neither npm nor pnpm was found."
    exit 1
fi

# 3. Generate MCP Configuration (mcp.config.json)
echo "[3/5] Generating MCP server configuration..."
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cat <<EOF > "${PROJECT_ROOT}/mcp.config.json"
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "${PROJECT_ROOT}"
      ]
    }
  }
}
EOF
echo "✅ Created ${PROJECT_ROOT}/mcp.config.json for MCP-compatible editors/agents."

# 4. Free UI Skills & Component Registries (Zero-Cost Relume Architecture)
echo "[4/5] Checking Free UI & Agent Skills..."
if command -v pnpm &> /dev/null; then
    echo "ℹ️ To configure shadcn/skills for coding agents, run: pnpm dlx skills add shadcn/ui"
    echo "ℹ️ Open Relume UI Tailwind primitives can be added with: pnpm add @relume_io/relume-ui @relume_io/relume-tailwind lucide-react"
else
    echo "ℹ️ To configure shadcn/skills for coding agents, run: npx -y skills add shadcn/ui"
    echo "ℹ️ Open Relume UI Tailwind primitives can be added with: npm install @relume_io/relume-ui @relume_io/relume-tailwind lucide-react"
fi

# 5. Check OmniDev Config Directory
echo "[5/5] Checking OmniDev config directory..."
CONFIG_DIR="${HOME}/.omnidev"
if [ ! -d "${CONFIG_DIR}" ]; then
    mkdir -p "${CONFIG_DIR}"
    echo "📁 Created ${CONFIG_DIR}"
fi

CONFIG_FILE="${CONFIG_DIR}/config.json"
if [ ! -f "${CONFIG_FILE}" ]; then
    cat <<EOF > "${CONFIG_FILE}"
{
  "defaultProvider": "gemini",
  "providers": {
    "gemini": {
      "model": "gemini-1.5-pro-latest",
      "keys": []
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
      "baseUrl": "http://localhost:11434",
      "model": "llama3"
    }
  }
}
EOF
    echo "✅ Seeded template configuration at ${CONFIG_FILE}"
else
    echo "ℹ️ Existing configuration found at ${CONFIG_FILE}"
fi

echo "=================================================="
echo "✅ Environment & MCP Setup Complete!"
echo "   You can inspect/edit: ~/.omnidev/config.json"
echo "=================================================="
