import { LLMRouter, defaultRouter } from "../core/llm/router.js";
import {
  loadPlan,
  savePlan,
  loadState,
  saveState,
  parsePlanTasks,
  type SessionState,
  type ParsedTask,
} from "../core/context/state.js";
import { readFileSafe, writeFileSafe } from "../utils/fs.js";

export interface CoderOptions {
  cwd?: string;
  step?: number;
  all?: boolean;
  model?: string;
  router?: LLMRouter;
  onChunk?: (text: string) => void;
  onFileWritten?: (filePath: string) => void;
}

export interface CoderResult {
  executedTasks: ParsedTask[];
  modifiedFiles: string[];
  allCompleted: boolean;
}

export interface ExtractedFile {
  relativePath: string;
  content: string;
}

export const CODER_SYSTEM_PROMPT = `You are OmniDev's Expert Coder Agent.
Your responsibility is to implement the specified task from the project plan cleanly and correctly.

Rules:
1. Write complete, functional code for each file you create or update. Do not leave placeholder comments like "// rest of code here".
2. Emit your file changes strictly in this format:

FILE: relative/path/to/file.ext
\`\`\`language
<complete file contents here>
\`\`\`

3. You may emit multiple FILE blocks if the task requires creating or modifying multiple files.
4. Only output files directly necessary for this specific task.`;

export function extractFilesFromResponse(response: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  // Regex: matches "FILE: <path>" followed by a markdown code block
  const fileRegex = /FILE:\s*([^\r\n]+)\r?\n```[a-zA-Z0-9_-]*\r?\n([\s\S]*?)```/g;

  let match: RegExpExecArray | null;
  while ((match = fileRegex.exec(response)) !== null) {
    const relativePath = match[1].trim().replace(/^['"`]|['"`]$/g, "");
    const content = match[2];
    if (relativePath) {
      files.push({ relativePath, content });
    }
  }

  return files;
}

export async function runCoder(options: CoderOptions): Promise<CoderResult> {
  const cwd = options.cwd || process.cwd();
  const router = options.router || defaultRouter;

  const planMarkdown = loadPlan(cwd);
  if (!planMarkdown) {
    throw new Error("No active plan found at .omnidev/plan.md. Run 'omnidev plan <task>' first.");
  }

  let state = loadState(cwd);
  if (!state) {
    state = {
      sessionId: "session-fallback",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt: "Execute plan",
      provider: router.getEffectiveProvider(),
      model: router.getModelName(router.getEffectiveProvider(), options.model),
      currentStep: 1,
      totalSteps: 0,
      completedSteps: [],
      status: "in_progress",
    };
  }

  const tasks = parsePlanTasks(planMarkdown);
  if (tasks.length === 0) {
    throw new Error("No tasks found in .omnidev/plan.md. Check plan formatting.");
  }

  // Determine tasks to execute
  let tasksToRun: ParsedTask[] = [];

  if (options.step !== undefined) {
    const target = tasks.find((t) => t.index === options.step);
    if (!target) {
      throw new Error(`Task ${options.step} not found in plan (Available tasks: 1 to ${tasks.length}).`);
    }
    tasksToRun = [target];
  } else if (options.all) {
    tasksToRun = tasks.filter((t) => !t.completed);
  } else {
    // Single next pending task
    const nextTask = tasks.find((t) => !t.completed) || tasks[0];
    tasksToRun = [nextTask];
  }

  const allModifiedFiles: string[] = [];
  let updatedPlan = planMarkdown;

  for (const task of tasksToRun) {
    // Collect context for files mentioned in the plan if they already exist
    const userPrompt = `
Current Task to Implement:
Task ${task.index}: ${task.title}
${task.rawText}

Full Project Plan Context:
\`\`\`markdown
${planMarkdown}
\`\`\`

Implement all changes needed for Task ${task.index}. Format each file using the FILE: <path> format.`;

    const coderOutput = await router.stream({
      system: CODER_SYSTEM_PROMPT,
      prompt: userPrompt,
      model: options.model,
      onChunk: options.onChunk,
    });

    const files = extractFilesFromResponse(coderOutput);

    for (const f of files) {
      const writtenPath = writeFileSafe(f.relativePath, f.content, cwd);
      allModifiedFiles.push(f.relativePath);
      if (options.onFileWritten) {
        options.onFileWritten(f.relativePath);
      }
    }

    // Mark task as completed in state and plan
    if (!state.completedSteps.includes(task.index)) {
      state.completedSteps.push(task.index);
    }

    // Replace "- [ ] Task N:" with "- [x] Task N:" in plan.md
    const regex = new RegExp(`(-\\s*\\[)\\s*(\\]\\s*(?:Task\\s*)?${task.index}[:\\s])`, "i");
    updatedPlan = updatedPlan.replace(regex, "$1x$2");
  }

  // Save updated plan.md
  savePlan(updatedPlan, cwd);

  // Update state.json
  const remaining = tasks.filter((t) => !state!.completedSteps.includes(t.index));
  state.currentStep = remaining.length > 0 ? remaining[0].index : tasks.length + 1;
  state.totalSteps = tasks.length;
  state.status = remaining.length === 0 ? "completed" : "in_progress";
  state.updatedAt = new Date().toISOString();
  saveState(state, cwd);

  return {
    executedTasks: tasksToRun,
    modifiedFiles: allModifiedFiles,
    allCompleted: remaining.length === 0,
  };
}
