import chalk from "chalk";
import { errorBox, log } from "./ui.js";
import { NoKeysAvailableError, AllKeysCoolingDownError } from "../core/key-manager/types.js";
import { ConfigError } from "../core/config/manager.js";

export function formatErrorMessage(error: unknown): { title: string; body: string } {
  if (error instanceof NoKeysAvailableError) {
    return {
      title: "Missing API Keys",
      body: error.message,
    };
  }

  if (error instanceof AllKeysCoolingDownError) {
    return {
      title: "Rate Limit Cooldown Active",
      body: error.message,
    };
  }

  if (error instanceof ConfigError) {
    return {
      title: "Configuration Error",
      body: error.message,
    };
  }

  const err = error as any;
  const msg = String(err?.message || error);

  // Network / Offline errors
  if (
    err?.code === "ENOTFOUND" ||
    err?.code === "ECONNREFUSED" ||
    err?.code === "ETIMEDOUT" ||
    msg.includes("fetch failed") ||
    msg.includes("Network error")
  ) {
    return {
      title: "Network Connection Error",
      body: `Could not reach the LLM provider endpoint.\nPlease check your internet connection or verify local Ollama is running.\nDetails: ${msg}`,
    };
  }

  // 401 Unauthorized / Invalid Key
  if (err?.statusCode === 401 || err?.status === 401 || msg.includes("401") || msg.includes("invalid_api_key")) {
    return {
      title: "Authentication Failed",
      body: `Invalid API key provided for the active provider.\nRun 'omnidev config --add-key <provider> <valid_key>' to update your credentials.`,
    };
  }

  return {
    title: "OmniDev Error",
    body: msg,
  };
}

export function handleCliError(error: unknown): void {
  const { title, body } = formatErrorMessage(error);
  console.error(errorBox(title, body));
  process.exitCode = 1;
}

export function setupProcessSignalHandlers(): void {
  process.on("SIGINT", () => {
    console.log(chalk.yellow("\n\nOperation cancelled by user (Ctrl+C). Exiting cleanly."));
    process.exit(130);
  });

  process.on("SIGTERM", () => {
    process.exit(143);
  });
}
