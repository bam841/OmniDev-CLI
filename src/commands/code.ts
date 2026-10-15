import { Command } from "commander";
import chalk from "chalk";
import { runCoder } from "../agents/coder.js";
import { log, banner, createSpinner, successBox } from "../utils/ui.js";

export function createCodeCommand(): Command {
  return new Command("code")
    .description("Execute pending implementation tasks from .omnidev/plan.md")
    .option("-s, --step <number>", "Execute a specific task step index")
    .option("-a, --all", "Execute all remaining tasks continuously")
    .option("-m, --model <model>", "Override default LLM model")
    .action(async (options) => {
      console.log(banner("OmniDev Coder", "Autonomous Task Implementation & Code Generation"));

      const stepNum = options.step !== undefined ? parseInt(options.step, 10) : undefined;
      const spinner = createSpinner("Loading plan and executing coder agent...");
      spinner.start();

      try {
        const result = await runCoder({
          step: stepNum,
          all: options.all,
          model: options.model,
          onFileWritten: (filePath) => {
            log.success(`Wrote: ${chalk.bold.cyan(filePath)}`);
          },
        });

        spinner.stop();

        const taskTitles = result.executedTasks.map((t) => `Task ${t.index}: ${t.title}`).join("\n");
        const fileList = result.modifiedFiles.length > 0
          ? result.modifiedFiles.map((f) => `  - ${chalk.cyan(f)}`).join("\n")
          : "  (No files modified)";

        console.log(
          successBox(
            result.allCompleted ? "All Tasks Completed!" : "Task Step Executed Successfully!",
            `Executed:\n${chalk.bold.yellow(taskTitles)}\n\n` +
            `Modified Files:\n${fileList}\n\n` +
            (result.allCompleted
              ? `Ready for audit: Run ${chalk.bold.green("omnidev review")} to inspect changes.`
              : `Next: Run ${chalk.bold.green("omnidev code")} for the next step.`)
          )
        );
      } catch (error: any) {
        spinner.stop();
        log.error(`Coder failed: ${error?.message || error}`);
        process.exitCode = 1;
      }
    });
}

export const codeCommand = createCodeCommand();
