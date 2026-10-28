import { Command } from "commander";
import chalk from "chalk";
import { runCoder } from "../agents/coder.js";
import { log, banner, createSpinner, successBox } from "../utils/ui.js";

export function createCodeCommand(): Command {
  return new Command("code")
    .description("Execute pending implementation tasks from .omnidev/plan.md")
    .option("-s, --step <number>", "Execute a specific task step index")
    .option("-a, --all", "Execute all remaining tasks continuously")
    .option("-u, --ui", "Execute UI wireframe component assembly from .omnidev/sitemap.json")
    .option("-m, --model <model>", "Override default LLM model")
    .action(async (options) => {
      const title = options.ui
        ? "OmniDev UI Coder (Relume Component Assembler)"
        : "OmniDev Coder";
      const subtitle = options.ui
        ? "Zero-Cost Wireframe Component Generation & Page Assembly"
        : "Autonomous Task Implementation & Code Generation";

      console.log(banner(title, subtitle));

      const stepNum = options.step !== undefined ? parseInt(options.step, 10) : undefined;
      const spinnerText = options.ui
        ? "Loading sitemap and assembling wireframe components..."
        : "Loading plan and executing coder agent...";

      const spinner = createSpinner(spinnerText);
      spinner.start();

      try {
        const result = await runCoder({
          step: stepNum,
          all: options.all,
          ui: options.ui,
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

        const heading = options.ui
          ? "UI Components Assembled Successfully!"
          : (result.allCompleted ? "All Tasks Completed!" : "Task Step Executed Successfully!");

        let details = `Executed:\n${chalk.bold.yellow(taskTitles)}\n\n` +
          `Modified Files:\n${fileList}\n\n`;

        if (result.allCompleted || options.ui) {
          details += `Ready for audit: Run ${chalk.bold.green("omnidev review")} to inspect changes.`;
        } else {
          details += `Next: Run ${chalk.bold.green("omnidev code")} for the next step.`;
        }

        console.log(successBox(heading, details));
      } catch (error: any) {
        spinner.stop();
        log.error(`Coder failed: ${error?.message || error}`);
        process.exitCode = 1;
      }
    });
}

export const codeCommand = createCodeCommand();
