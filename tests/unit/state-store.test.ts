import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  ensureOmniDevDir,
  savePlan,
  loadPlan,
  saveState,
  loadState,
  saveReview,
  loadReview,
  parsePlanTasks,
  type SessionState,
} from "../../src/core/context/state.js";

describe("State Store (.omnidev/)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omnidev-state-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("creates .omnidev directory and appends to .gitignore", () => {
    fs.writeFileSync(path.join(tempDir, ".gitignore"), "node_modules/\n");

    const omniDir = ensureOmniDevDir(tempDir);
    expect(fs.existsSync(omniDir)).toBe(true);

    const gitignoreContent = fs.readFileSync(path.join(tempDir, ".gitignore"), "utf-8");
    expect(gitignoreContent).toContain(".omnidev/");
  });

  it("saves and loads plan.md", () => {
    const planText = "# Feature Plan\n\n- [ ] Task 1: Setup DB\n- [ ] Task 2: Build API\n";
    savePlan(planText, tempDir);

    const loaded = loadPlan(tempDir);
    expect(loaded).toBe(planText);
  });

  it("saves and loads validated session state", () => {
    const state: SessionState = {
      sessionId: "session-12345",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt: "Implement user authentication",
      provider: "gemini",
      model: "gemini-1.5-pro",
      currentStep: 1,
      totalSteps: 2,
      completedSteps: [],
      status: "in_progress",
    };

    saveState(state, tempDir);
    const loaded = loadState(tempDir);

    expect(loaded).not.toBeNull();
    expect(loaded?.sessionId).toBe("session-12345");
    expect(loaded?.status).toBe("in_progress");
  });

  it("saves and loads review.md", () => {
    const reviewText = "# Code Review\n\nNo critical issues detected.\n";
    saveReview(reviewText, tempDir);

    const loaded = loadReview(tempDir);
    expect(loaded).toBe(reviewText);
  });

  it("parses task items from plan markdown", () => {
    const markdown = `
# Plan
### Task 1: Initialize Database
- [ ] Task 1: Initialize Database
### Task 2: Create Endpoints
- [x] Task 2: Create Endpoints
`;

    const tasks = parsePlanTasks(markdown);
    expect(tasks.length).toBe(2);
    expect(tasks[0].index).toBe(1);
    expect(tasks[0].completed).toBe(false);
    expect(tasks[1].index).toBe(2);
    expect(tasks[1].completed).toBe(true);
  });
});
