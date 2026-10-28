import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { isGitRepository, getGitDiff } from "../../src/core/context/git.js";

describe("Git Context Extractor", () => {
  let nonGitDir: string;
  let gitDir: string;

  beforeEach(() => {
    nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), "nongit-"));
    gitDir = fs.mkdtempSync(path.join(os.tmpdir(), "git-repo-"));

    // Initialize real git repo
    execSync("git init", { cwd: gitDir });
    execSync('git config user.name "Test User"', { cwd: gitDir });
    execSync('git config user.email "test@example.com"', { cwd: gitDir });

    // Initial commit
    fs.writeFileSync(path.join(gitDir, "hello.txt"), "hello world\n");
    execSync("git add hello.txt", { cwd: gitDir });
    execSync('git commit -m "Initial commit"', { cwd: gitDir });
  });

  afterEach(() => {
    if (fs.existsSync(nonGitDir)) {
      fs.rmSync(nonGitDir, { recursive: true, force: true });
    }
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }
  });

  it("identifies non-git directory correctly", () => {
    expect(isGitRepository(nonGitDir)).toBe(false);
    const result = getGitDiff({ cwd: nonGitDir });
    expect(result.isGit).toBe(false);
    expect(result.diff).toBe("");
  });

  it("identifies git repository and extracts diff of modified files", () => {
    expect(isGitRepository(gitDir)).toBe(true);

    // Modify file
    fs.appendFileSync(path.join(gitDir, "hello.txt"), "new modified line\n");

    const result = getGitDiff({ cwd: gitDir });
    expect(result.isGit).toBe(true);
    expect(result.diff).toContain("+new modified line");
    expect(result.changedFiles).toContain("hello.txt");
  });

  it("handles staged diff option", () => {
    fs.writeFileSync(path.join(gitDir, "staged.txt"), "staged content\n");
    execSync("git add staged.txt", { cwd: gitDir });

    const unstagedResult = getGitDiff({ cwd: gitDir, stagedOnly: false });
    expect(unstagedResult.diff).toContain("+staged content");

    const stagedResult = getGitDiff({ cwd: gitDir, stagedOnly: true });
    expect(stagedResult.diff).toContain("+staged content");
    expect(stagedResult.changedFiles).toContain("staged.txt");
  });

  it("truncates long diffs when maxLines is reached", () => {
    // Generate 50 lines
    const manyLines = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    fs.writeFileSync(path.join(gitDir, "hello.txt"), manyLines);

    const result = getGitDiff({ cwd: gitDir, maxLines: 10 });
    expect(result.truncated).toBe(true);
    expect(result.diff).toContain("Diff truncated");
  });
});
