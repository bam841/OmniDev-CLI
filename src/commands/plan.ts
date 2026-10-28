import { Command } from "commander";
import chalk from "chalk";
import { runPlanner } from "../agents/planner.js";
import { log, banner, createSpinner, successBox } from "../utils/ui.js";

export function createPlanCommand(): Command {
  return new Command("plan")
    .description("Analyze project context and generate an execution roadmap in .omnidev/plan.md")
    .argument("<prompt>", "Description of the feature, refactor, or bug to plan")
    .option("-m, --model <model>", "Override default LLM model")
    .option("-u, --ui", "Generate a UI wireframe and sitemap plan using free open-source component blocks")
    .option("--dry-run", "Output the plan without writing to disk")
    .action(async (prompt, options) => {
      const title = options.ui
        ? "OmniDev UI Planner (Open Relume Engine)"
        : "OmniDev Planner";
      const subtitle = options.ui
        ? "Zero-Cost Wireframe & Component Sitemap Decomposition"
        : "Architectural Analysis & Task Decomposition";

      console.log(banner(title, subtitle));
      log.info(`Objective: ${chalk.bold.cyan(prompt)}`);
      if (options.ui) {
        log.info(chalk.dim("Mode: UI Wireframe & Component Sitemap Planning"));
      }

      const spinnerMsg = options.ui
        ? "Analyzing interface requirements and building component sitemap..."
        : "Scanning repository context and architecting plan...";

      const spinner = createSpinner(spinnerMsg);
      spinner.start();

      let isStreaming = false;

      try {
        const result = await runPlanner({
          prompt,
          model: options.model,
          ui: options.ui,
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
          let details = `Saved to: ${chalk.bold.cyan(result.planPath)}\n`;
          if (result.sitemapPath) {
            details += `Sitemap: ${chalk.bold.cyan(result.sitemapPath)}\n`;
          }
          details += `Total tasks detected: ${chalk.bold.yellow(result.tasksCount)}\n\n`;

          const nextCmd = options.ui ? "omnidev code --ui" : "omnidev code";
          details += `Next step: Run ${chalk.bold.green(nextCmd)} to begin implementation.`;

          console.log(
            successBox(
              options.ui ? "UI Plan & Sitemap Generated Successfully!" : "Plan Generated Successfully!",
              details
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
