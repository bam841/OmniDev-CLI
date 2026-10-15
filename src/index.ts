import { Command } from "commander";
import { createConfigCommand } from "./commands/config.js";
import { createPlanCommand } from "./commands/plan.js";
import { createCodeCommand } from "./commands/code.js";
import { createReviewCommand } from "./commands/review.js";
import { setupProcessSignalHandlers } from "./utils/errors.js";

export function createProgram(): Command {
  const cmd = new Command()
    .name("omnidev")
    .description("Autonomous multi-agent CLI for planning, coding, and code review with BYOK key rotation")
    .version("0.1.0");

  cmd.addCommand(createConfigCommand());
  cmd.addCommand(createPlanCommand());
  cmd.addCommand(createCodeCommand());
  cmd.addCommand(createReviewCommand());

  return cmd;
}

export const program = createProgram();

export function run(args: string[] = process.argv) {
  setupProcessSignalHandlers();
  createProgram().parse(args);
}

// Auto-run when executed directly from CLI, but avoid auto-execution inside Vitest test runners
if (!process.env.VITEST) {
  run();
}
