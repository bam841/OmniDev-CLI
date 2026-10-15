import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { runPlanner } from "../../src/agents/planner.js";
import { LLMRouter } from "../../src/core/llm/router.js";
import { KeyManager } from "../../src/core/key-manager/index.js";
import { loadPlan, loadState } from "../../src/core/context/state.js";
import type { OmniDevConfig } from "../../src/core/config/schema.js";

describe("Planner Agent Integration", () => {
  let tempDir: string;
  let mockRouter: LLMRouter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omnidev-planner-test-"));
    fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tempDir, "src", "index.ts"), "// existing code");

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

    // Mock stream method on router
    vi.spyOn(mockRouter, "stream").mockImplementation(async (opts) => {
      const mockPlan = `
# Implementation Plan: Add Health Check

### Task 1: Create Health Endpoint
- [ ] Task 1: Create Health Endpoint
**Description:** Implement /health endpoint returning status 200.
**Files to create/modify:** src/health.ts
**Verification:** npm test

### Task 2: Register Health Route
- [ ] Task 2: Register Health Route
**Description:** Mount health router in index.ts.
**Files to create/modify:** src/index.ts
**Verification:** npm test
`;
      if (opts.onChunk) {
        opts.onChunk(mockPlan);
      }
      return mockPlan;
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("generates and saves plan.md and state.json", async () => {
    const result = await runPlanner({
      prompt: "Add health check endpoint",
      cwd: tempDir,
      router: mockRouter,
    });

    expect(result.tasksCount).toBe(2);
    expect(result.planPath).toBeDefined();

    const savedPlan = loadPlan(tempDir);
    expect(savedPlan).toContain("Add Health Check");
    expect(savedPlan).toContain("Task 1: Create Health Endpoint");

    const state = loadState(tempDir);
    expect(state).not.toBeNull();
    expect(state?.prompt).toBe("Add health check endpoint");
    expect(state?.totalSteps).toBe(2);
    expect(state?.currentStep).toBe(1);
  });

  it("respects dryRun option without creating .omnidev files", async () => {
    const result = await runPlanner({
      prompt: "Add health check endpoint",
      cwd: tempDir,
      router: mockRouter,
      dryRun: true,
    });

    expect(result.planPath).toBeUndefined();
    expect(loadPlan(tempDir)).toBeNull();
    expect(loadState(tempDir)).toBeNull();
  });
});
