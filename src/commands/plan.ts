import { Command } from "commander";
import chalk from "chalk";
import { runPlanner } from "../agents/planner.js";
import { log, banner, createSpinner, successBox } from "../utils/ui.js";

export function createPlanCommand(): Command {
  return new Command("plan")
    .description("Analyze project context and generate an execution roadmap in .omnidev/plan.md")
    .argument("<prompt>", "Description of the feature, refactor, or bug to plan")
    .option("-m, --model <model>", "Override default LLM model")
    .option("--dry-run", "Output the plan without writing to disk")
    .action(async (prompt, options) => {
      console.log(banner("OmniDev Planner", "Architectural Analysis & Task Decomposition"));
      log.info(`Objective: ${chalk.bold.cyan(prompt)}`);

      const spinner = createSpinner("Scanning repository context and architecting plan...");
      spinner.start();

      let isStreaming = false;

      try {
        const result = await runPlanner({
          prompt,
          model: options.model,
          dryRun: options.dryRun,
          onChunk: (chunk) => {
            if (!isStreaming) {
              spinner.stop();
              isStreaming = true;
              console.log(chalk.bold.dim("\n--- Plan Output Stream ---"));
            }
            process.stdout.write(chunk);
          },
        });

        if (!isStreaming) {
          spinner.stop();
        }

        console.log("\n");
        if (options.dryRun) {
          log.info("Dry-run complete. No files written.");
        } else {
          console.log(
            successBox(
              "Plan Generated Successfully!",
              `Saved to: ${chalk.bold.cyan(result.planPath)}\n` +
              `Total tasks detected: ${chalk.bold.yellow(result.tasksCount)}\n\n` +
              `Next step: Run ${chalk.bold.green("omnidev code")} to begin implementation.`
            )
          );
        }
      } catch (error: any) {
        spinner.stop();
        log.error(`Planner failed: ${error?.message || error}`);
        process.exitCode = 1;
      }
    });
}

export const planCommand = createPlanCommand();
