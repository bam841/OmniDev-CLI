import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCoder, extractFilesFromResponse } from "../../src/agents/coder.js";
import { savePlan, saveState, loadPlan, loadState } from "../../src/core/context/state.js";
import { LLMRouter } from "../../src/core/llm/router.js";
import { KeyManager } from "../../src/core/key-manager/index.js";
import type { OmniDevConfig } from "../../src/core/config/schema.js";

describe("Coder Agent Integration", () => {
  let tempDir: string;
  let mockRouter: LLMRouter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omnidev-coder-test-"));

    const mockConfig: OmniDevConfig = {
      defaultProvider: "gemini",
      providers: {
        gemini: { model: "gemini-1.5-pro", keys: ["test-key"] },
        openai: { model: "gpt-4o", keys: [] },
        anthropic: { model: "claude-3-5-sonnet", keys: [] },
        ollama: { model: "llama3", baseUrl: "http://localhost:11434" },
      },
    };

    const keyManager = new KeyManager(mockConfig);
    mockRouter = new LLMRouter(keyManager, mockConfig);

    vi.spyOn(mockRouter, "stream").mockImplementation(async (opts) => {
      return `Here is the code implementation:

FILE: src/math.ts
\`\`\`typescript
export function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

FILE: tests/math.test.ts
\`\`\`typescript
import { add } from "../src/math";
console.log(add(1, 2));
\`\`\`
`;
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("extracts multiple file blocks from LLM output correctly", () => {
    const text = `
FILE: src/server.ts
\`\`\`typescript
export const port = 3000;
\`\`\`

FILE: config/settings.json
\`\`\`json
{ "env": "dev" }
\`\`\`
`;
    const files = extractFilesFromResponse(text);
    expect(files).toHaveLength(2);
    expect(files[0].relativePath).toBe("src/server.ts");
    expect(files[0].content).toContain("export const port = 3000;");
    expect(files[1].relativePath).toBe("config/settings.json");
    expect(files[1].content).toContain('"env": "dev"');
  });

  it("executes task from plan.md, creates code files, and marks task completed", async () => {
    const initialPlan = `# Implementation Plan

### Task 1: Create Math Utility
- [ ] Task 1: Create Math Utility
**Description:** Implement add function

### Task 2: Create Test
- [ ] Task 2: Create Test
**Description:** Add tests
`;

    savePlan(initialPlan, tempDir);
    saveState({
      sessionId: "session-test",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt: "Create math utils",
      provider: "gemini",
      model: "gemini-1.5-pro",
      currentStep: 1,
      totalSteps: 2,
      completedSteps: [],
      status: "in_progress",
    }, tempDir);

    const result = await runCoder({
      cwd: tempDir,
      router: mockRouter,
    });

    expect(result.executedTasks).toHaveLength(1);
    expect(result.executedTasks[0].index).toBe(1);
    expect(result.modifiedFiles).toContain("src/math.ts");

    // Check files actually created on disk
    expect(fs.existsSync(path.join(tempDir, "src", "math.ts"))).toBe(true);
    expect(fs.readFileSync(path.join(tempDir, "src", "math.ts"), "utf-8")).toContain("export function add");

    // Check plan updated with checkbox check
    const updatedPlan = loadPlan(tempDir);
    expect(updatedPlan).toContain("- [x] Task 1: Create Math Utility");
    expect(updatedPlan).toContain("- [ ] Task 2: Create Test");

    // Check state updated
    const updatedState = loadState(tempDir);
    expect(updatedState?.completedSteps).toContain(1);
    expect(updatedState?.currentStep).toBe(2);
  });
});
