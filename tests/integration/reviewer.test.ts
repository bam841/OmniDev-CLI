import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { runReviewer } from "../../src/agents/reviewer.js";
import { loadReview } from "../../src/core/context/state.js";
import { LLMRouter } from "../../src/core/llm/router.js";
import { KeyManager } from "../../src/core/key-manager/index.js";
import type { OmniDevConfig } from "../../src/core/config/schema.js";

describe("Reviewer Agent Integration", () => {
  let tempDir: string;
  let mockRouter: LLMRouter;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omnidev-reviewer-test-"));

    // Init git repo
    execSync("git init", { cwd: tempDir });
    execSync("git config user.name 'Reviewer Test'", { cwd: tempDir });
    execSync("git config user.email 'test@example.com'", { cwd: tempDir });

    fs.writeFileSync(path.join(tempDir, "index.ts"), "console.log('original');\n");
    execSync("git add index.ts", { cwd: tempDir });
    execSync("git commit -m 'Initial'", { cwd: tempDir });

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
      return `
# Code Review Report

## Summary
The changes introduce clean additions.

## Verdict: [APPROVED]

## Findings
### 🚨 Critical Issues
- None detected

### ⚠️ Warnings & Edge Cases
- None detected

### 💡 Suggestions & Minor Improvements
- Consider adding typed return annotations.
`;
    });
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("returns NO_CHANGES when working directory has no diff", async () => {
    const result = await runReviewer({
      cwd: tempDir,
      router: mockRouter,
    });

    expect(result.verdict).toBe("NO_CHANGES");
    expect(result.reviewMarkdown).toContain("No changes detected");
  });

  it("extracts git diff, generates review report, and saves .omnidev/review.md", async () => {
    // Modify file to produce a diff
    fs.appendFileSync(path.join(tempDir, "index.ts"), "export const status = 200;\n");

    const result = await runReviewer({
      cwd: tempDir,
      router: mockRouter,
    });

    expect(result.verdict).toBe("APPROVED");
    expect(result.changedFiles).toContain("index.ts");
    expect(result.reviewPath).toBeDefined();

    const savedReview = loadReview(tempDir);
    expect(savedReview).toContain("Verdict: [APPROVED]");
    expect(savedReview).toContain("Summary");
  });
});
