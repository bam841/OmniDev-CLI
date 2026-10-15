import { Command } from "commander";
import chalk from "chalk";
import { runReviewer } from "../agents/reviewer.js";
import { log, banner, createSpinner, successBox, infoBox } from "../utils/ui.js";

export function createReviewCommand(): Command {
  return new Command("review")
    .description("Audit working directory and staged git diff against .omnidev/plan.md")
    .option("-s, --staged", "Only review staged git changes")
    .option("-m, --model <model>", "Override default LLM model")
    .action(async (options) => {
      console.log(banner("OmniDev Reviewer", "Security, Performance & Correctness Audit"));

      const spinner = createSpinner("Analyzing git diff and running automated code review...");
      spinner.start();

      let isStreaming = false;

      try {
        const result = await runReviewer({
          staged: options.staged,
          model: options.model,
          onChunk: (chunk) => {
            if (!isStreaming) {
              spinner.stop();
              isStreaming = true;
              console.log(chalk.bold.dim("\n--- Review Report Stream ---"));
            }
            process.stdout.write(chunk);
          },
        });

        if (!isStreaming) {
          spinner.stop();
        }

        console.log("\n");

        if (result.verdict === "NO_CHANGES") {
          console.log(infoBox("Review Complete", result.reviewMarkdown));
          return;
        }

        const verdictColor = result.verdict === "APPROVED" ? chalk.bold.green("APPROVED") : chalk.bold.red("CHANGES REQUESTED");

        console.log(
          successBox(
            `Review Complete — Verdict: ${verdictColor}`,
            `Files Audited: ${chalk.bold.cyan(result.changedFiles.length)}\n` +
            `Report Saved to: ${chalk.bold.cyan(result.reviewPath)}\n\n` +
            `You can inspect the full report anytime in ${chalk.bold.yellow(".omnidev/review.md")}`
          )
        );
      } catch (error: any) {
        spinner.stop();
        log.error(`Reviewer failed: ${error?.message || error}`);
        process.exitCode = 1;
      }
    });
}

export const reviewCommand = createReviewCommand();
