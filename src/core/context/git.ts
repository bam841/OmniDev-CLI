import { execSync } from "node:child_process";
import path from "node:path";

export interface GitDiffOptions {
  cwd?: string;
  stagedOnly?: boolean;
  maxLines?: number;
}

export interface GitDiffResult {
  isGit: boolean;
  diff: string;
  changedFiles: string[];
  truncated: boolean;
}

export function isGitRepository(cwd: string = process.cwd()): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return true;
  } catch {
    return false;
  }
}

export function getGitDiff(options: GitDiffOptions = {}): GitDiffResult {
  const cwd = path.resolve(options.cwd || process.cwd());
  const maxLines = options.maxLines ?? 500;

  if (!isGitRepository(cwd)) {
    return {
      isGit: false,
      diff: "",
      changedFiles: [],
      truncated: false,
    };
  }

  let diffCommand = "git diff";
  if (options.stagedOnly) {
    diffCommand = "git diff --staged";
  } else {
    // If HEAD exists, compare against HEAD to include both staged and unstaged
    try {
      execSync("git rev-parse --verify HEAD", { cwd, stdio: ["ignore", "pipe", "ignore"] });
      diffCommand = "git diff HEAD";
    } catch {
      // Repository has no commits yet, just use git diff
      diffCommand = "git diff";
    }
  }

  try {
    const rawDiff = execSync(diffCommand, {
      cwd,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["ignore", "pipe", "ignore"],
    });

    const nameOnlyCmd = options.stagedOnly ? "git diff --staged --name-only" : "git diff HEAD --name-only";
    let changedFiles: string[] = [];
    try {
      const rawNames = execSync(nameOnlyCmd, {
        cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      changedFiles = rawNames
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);
    } catch {
      // Fallback if HEAD doesn't exist
      try {
        const rawNames = execSync("git diff --name-only", {
          cwd,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        changedFiles = rawNames.split("\n").map((f) => f.trim()).filter(Boolean);
      } catch {
        changedFiles = [];
      }
    }

    const lines = rawDiff.split("\n");
    let truncated = false;
    let finalDiff = rawDiff;

    if (lines.length > maxLines) {
      finalDiff = lines.slice(0, maxLines).join("\n") +
        `\n\n... [Diff truncated: showing first ${maxLines} of ${lines.length} lines to conserve tokens]`;
      truncated = true;
    }

    return {
      isGit: true,
      diff: finalDiff,
      changedFiles,
      truncated,
    };
  } catch (error: any) {
    return {
      isGit: true,
      diff: `Failed to extract git diff: ${error?.message || error}`,
      changedFiles: [],
      truncated: false,
    };
  }
}
