import { Command } from "commander";
import * as p from "@clack/prompts";
import chalk from "chalk";
import {
  loadConfig,
  saveConfig,
  getMaskedConfig,
  getConfigPath,
} from "../core/config/manager.js";
import {
  DEFAULT_CONFIG,
  SupportedProviderEnum,
  type SupportedProvider,
} from "../core/config/schema.js";
import { log, infoBox } from "../utils/ui.js";

export function createConfigCommand(): Command {
  return new Command("config")
    .description("Manage OmniDev CLI configuration and API keys (~/.omnidev/config.json)")
    .option("-s, --show", "Display the current configuration with masked keys")
    .option("-p, --set-provider <provider>", "Set the default LLM provider (gemini, openai, anthropic, ollama)")
    .option("-a, --add-key <pair...>", "Add API key to provider: --add-key <provider> <key>")
    .option("--reset", "Reset configuration to defaults")
    .action(async (options) => {
      const configPath = getConfigPath();
      const config = loadConfig(configPath);

      if (options.show) {
        const masked = getMaskedConfig(config);
        console.log(infoBox("OmniDev Configuration", `Path: ${chalk.cyan(configPath)}\n\n${JSON.stringify(masked, null, 2)}`));
        return;
      }

      if (options.reset) {
        saveConfig(structuredClone(DEFAULT_CONFIG), configPath);
        log.success(`Configuration reset to defaults at ${chalk.cyan(configPath)}`);
        return;
      }

      if (options.setProvider) {
        const parsed = SupportedProviderEnum.safeParse(options.setProvider);
        if (!parsed.success) {
          log.error(`Invalid provider '${options.setProvider}'. Choose from: ${SupportedProviderEnum.options.join(", ")}`);
          process.exitCode = 1;
          return;
        }
        config.defaultProvider = parsed.data;
        saveConfig(config, configPath);
        log.success(`Default provider set to: ${chalk.bold.green(config.defaultProvider)}`);
        return;
      }

      if (options.addKey) {
        const [providerArg, keyArg] = options.addKey;
        if (!providerArg || !keyArg) {
          log.error("Usage: omnidev config --add-key <provider> <key>");
          process.exitCode = 1;
          return;
        }
        const parsed = SupportedProviderEnum.safeParse(providerArg);
        if (!parsed.success || parsed.data === "ollama") {
          log.error(`Invalid provider '${providerArg}' for API keys. Must be gemini, openai, or anthropic.`);
          process.exitCode = 1;
          return;
        }
        const cloudProvider = parsed.data;
        if (!config.providers[cloudProvider].keys.includes(keyArg)) {
          config.providers[cloudProvider].keys.push(keyArg);
          saveConfig(config, configPath);
          log.success(`Added API key to ${chalk.bold.green(cloudProvider)} (Total keys: ${config.providers[cloudProvider].keys.length})`);
        } else {
          log.warn(`Key already exists in ${cloudProvider} key pool.`);
        }
        return;
      }

      // Interactive mode via @clack/prompts
      p.intro(chalk.bold.cyan("OmniDev CLI Configuration"));

      const action = await p.select({
        message: "What would you like to configure?",
        options: [
          { value: "view", label: "View current configuration" },
          { value: "defaultProvider", label: "Change default LLM provider" },
          { value: "addKey", label: "Add an API key to a provider" },
          { value: "exit", label: "Exit" },
        ],
      });

      if (p.isCancel(action) || action === "exit") {
        p.outro("Configuration unchanged.");
        return;
      }

      if (action === "view") {
        const masked = getMaskedConfig(config);
        console.log(infoBox("OmniDev Configuration", `Path: ${chalk.cyan(configPath)}\n\n${JSON.stringify(masked, null, 2)}`));
        p.outro("Done.");
        return;
      }

      if (action === "defaultProvider") {
        const selected = await p.select({
          message: "Select default provider:",
          initialValue: config.defaultProvider,
          options: [
            { value: "gemini", label: "Google Gemini (Recommended for speed & context)" },
            { value: "openai", label: "OpenAI (GPT-4o)" },
            { value: "anthropic", label: "Anthropic Claude (3.5 Sonnet)" },
            { value: "ollama", label: "Ollama (Local inference, zero cost)" },
          ],
        });

        if (!p.isCancel(selected)) {
          config.defaultProvider = selected as SupportedProvider;
          saveConfig(config, configPath);
          p.outro(`Default provider updated to: ${chalk.bold.green(config.defaultProvider)}`);
        } else {
          p.outro("Cancelled.");
        }
        return;
      }

      if (action === "addKey") {
        const provider = await p.select({
          message: "Select provider to add an API key for:",
          options: [
            { value: "gemini", label: "Google Gemini" },
            { value: "openai", label: "OpenAI" },
            { value: "anthropic", label: "Anthropic" },
          ],
        });

        if (p.isCancel(provider)) {
          p.outro("Cancelled.");
          return;
        }

        const keyInput = await p.password({
          message: `Enter API key for ${provider}:`,
          validate: (value) => {
            if (!value || value.trim().length === 0) return "API key cannot be empty.";
          },
        });

        if (p.isCancel(keyInput)) {
          p.outro("Cancelled.");
          return;
        }

        const cloudProvider = provider as "gemini" | "openai" | "anthropic";
        if (!config.providers[cloudProvider].keys.includes(keyInput.trim())) {
          config.providers[cloudProvider].keys.push(keyInput.trim());
          saveConfig(config, configPath);
          p.outro(`Key added successfully to ${cloudProvider}! Total keys: ${config.providers[cloudProvider].keys.length}`);
        } else {
          p.outro("This key is already registered.");
        }
      }
    });
}

export const configCommand = createConfigCommand();
