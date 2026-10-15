import crypto from "node:crypto";
import { LLMRouter, defaultRouter } from "../core/llm/router.js";
import { scanRepositoryTree } from "../core/context/tree.js";
import { savePlan, saveState, parsePlanTasks, type SessionState } from "../core/context/state.js";

export interface PlannerOptions {
  prompt: string;
  cwd?: string;
  model?: string;
  router?: LLMRouter;
  dryRun?: boolean;
  onChunk?: (text: string) => void;
}

export interface PlannerResult {
  planMarkdown: string;
  planPath?: string;
  sessionId: string;
  tasksCount: number;
}

export const PLANNER_SYSTEM_PROMPT = `You are OmniDev's Lead Architect Agent.
Your task is to analyze the user's project structure and feature request, then create a clear, step-by-step implementation plan.

Follow these strict rules:
1. Slice tasks vertically: each task should be an implementable, testable unit of work.
2. Structure every task clearly:
   ### Task N: <Descriptive Title>
   - [ ] Task N: <Descriptive Title>
   **Description:** <Detailed explanation of what this task accomplishes>
   **Files to create/modify:** <List of specific file paths relative to project root>
   **Verification:** <Explicit command or check, e.g. \`npm test\` or \`node ...\`>
3. Keep tasks ordered logically so dependencies are built first.
4. Output cleanly in Github Flavored Markdown.`;

export async function runPlanner(options: PlannerOptions): Promise<PlannerResult> {
  const cwd = options.cwd || process.cwd();
  const router = options.router || defaultRouter;
  const sessionId = `omnidev-session-${crypto.randomUUID().slice(0, 8)}`;

  // 1. Gather repository tree context
  const { tree } = scanRepositoryTree({ cwd, maxDepth: 4 });

  const userPrompt = `Project Directory Structure:
\`\`\`
${tree}
\`\`\`

User Request:
${options.prompt}

Generate a comprehensive, step-by-step implementation plan following the required task structure.`;

  // 2. Invoke LLM
  const planMarkdown = await router.stream({
    system: PLANNER_SYSTEM_PROMPT,
    prompt: userPrompt,
    model: options.model,
    onChunk: options.onChunk,
  });

  const parsedTasks = parsePlanTasks(planMarkdown);
  const totalTasks = parsedTasks.length;

  let planPath: string | undefined;

  if (!options.dryRun) {
    planPath = savePlan(planMarkdown, cwd);

    const effectiveProvider = router.getEffectiveProvider();
    const modelName = router.getModelName(effectiveProvider, options.model);

    const state: SessionState = {
      sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt: options.prompt,
      provider: effectiveProvider,
      model: modelName,
      currentStep: 1,
      totalSteps: totalTasks,
      completedSteps: [],
      status: "planning",
    };

    saveState(state, cwd);
  }

  return {
    planMarkdown,
    planPath,
    sessionId,
    tasksCount: totalTasks,
  };
}
