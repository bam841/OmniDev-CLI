import { LLMRouter, defaultRouter } from "../core/llm/router.js";
import { getGitDiff } from "../core/context/git.js";
import { loadPlan, loadState, saveState, saveReview } from "../core/context/state.js";

export interface ReviewerOptions {
  cwd?: string;
  staged?: boolean;
  model?: string;
  router?: LLMRouter;
  onChunk?: (text: string) => void;
}

export interface ReviewerResult {
  reviewMarkdown: string;
  reviewPath?: string;
  changedFiles: string[];
  verdict: "APPROVED" | "CHANGES_REQUESTED" | "NO_CHANGES";
}

export const REVIEWER_SYSTEM_PROMPT = `You are OmniDev's Senior Security & Code Reviewer Agent.
Your responsibility is to rigorously audit the provided git diff against the implementation plan and software engineering best practices.

Review Dimensions:
1. Correctness: Does the diff fulfill the intended task without breaking existing behavior?
2. Security: Check for path traversals, injection vulnerabilities, leaked secrets, or unsafe assumptions.
3. Performance: Check for memory leaks, unindexed operations, or unoptimized loops.
4. Clean Code: Check naming, error handling, readability, and test coverage.

Required Output Format:
# Code Review Report

## Summary
<Concise overview of the changes and overall quality>

## Verdict: [APPROVED | CHANGES REQUESTED]

## Findings
### 🚨 Critical Issues
- <Bullet points or "None detected">

### ⚠️ Warnings & Edge Cases
- <Bullet points or "None detected">

### 💡 Suggestions & Minor Improvements
- <Bullet points>

## Plan Alignment
<Verify if the changes match the requirements in .omnidev/plan.md>`;

export async function runReviewer(options: ReviewerOptions): Promise<ReviewerResult> {
  const cwd = options.cwd || process.cwd();
  const router = options.router || defaultRouter;

  // 1. Extract git diff
  const diffResult = getGitDiff({
    cwd,
    stagedOnly: options.staged,
    maxLines: 600,
  });

  if (!diffResult.isGit) {
    return {
      reviewMarkdown: "# Code Review Report\n\n**Notice:** The current directory is not a git repository. Initialize git (`git init`) to track and review code changes.",
      changedFiles: [],
      verdict: "NO_CHANGES",
    };
  }

  if (!diffResult.diff || diffResult.diff.trim().length === 0) {
    return {
      reviewMarkdown: "# Code Review Report\n\n**Notice:** No changes detected in the working directory to review. Modify files or stage changes before running review.",
      changedFiles: [],
      verdict: "NO_CHANGES",
    };
  }

  // 2. Load plan context if available
  const planMarkdown = loadPlan(cwd) || "No .omnidev/plan.md found. Perform general code review.";

  const userPrompt = `
Implementation Plan Context:
\`\`\`markdown
${planMarkdown}
\`\`\`

Changed Files:
${diffResult.changedFiles.map((f) => `- ${f}`).join("\n")}

Git Diff:
\`\`\`diff
${diffResult.diff}
\`\`\`

Perform a comprehensive code review following the specified format.`;

  // 3. Invoke LLM
  const reviewMarkdown = await router.stream({
    system: REVIEWER_SYSTEM_PROMPT,
    prompt: userPrompt,
    model: options.model,
    onChunk: options.onChunk,
  });

  // 4. Save review artifact
  const reviewPath = saveReview(reviewMarkdown, cwd);

  // 5. Update state
  const state = loadState(cwd);
  if (state) {
    state.status = "reviewed";
    state.updatedAt = new Date().toISOString();
    saveState(state, cwd);
  }

  const verdictMatch = reviewMarkdown.match(/##\s*Verdict:\s*\[?(APPROVED|CHANGES\s*REQUESTED)\]?/i);
  let verdict: "APPROVED" | "CHANGES_REQUESTED" = "APPROVED";
  if (verdictMatch && verdictMatch[1].toUpperCase().includes("CHANGES")) {
    verdict = "CHANGES_REQUESTED";
  }

  return {
    reviewMarkdown,
    reviewPath,
    changedFiles: diffResult.changedFiles,
    verdict,
  };
}
