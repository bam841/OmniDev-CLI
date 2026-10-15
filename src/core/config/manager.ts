import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  OmniDevConfigSchema,
  DEFAULT_CONFIG,
  type OmniDevConfig,
  type SupportedProvider,
} from "./schema.js";

export class ConfigError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ConfigError";
  }
}

export function getConfigPath(customPath?: string): string {
  if (customPath) {
    return path.resolve(customPath);
  }
  if (process.env.OMNIDEV_CONFIG_PATH) {
    return path.resolve(process.env.OMNIDEV_CONFIG_PATH);
  }
  return path.join(os.homedir(), ".omnidev", "config.json");
}

export function loadConfig(customPath?: string): OmniDevConfig {
  const configPath = getConfigPath(customPath);

  if (!fs.existsSync(configPath)) {
    const freshDefault = structuredClone(DEFAULT_CONFIG);
    saveConfig(freshDefault, configPath);
    return freshDefault;
  }

  try {
    const rawContent = fs.readFileSync(configPath, "utf-8");
    const parsedJson = JSON.parse(rawContent);
    const validated = OmniDevConfigSchema.parse(parsedJson);
    return validated;
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new ConfigError(
        `Failed to parse config file at ${configPath}: Invalid JSON format.\nPlease check or reset the file.`,
        error
      );
    }
    if (error?.issues) {
      const issueDetails = error.issues
        .map((iss: any) => `  - ${iss.path.join(".")}: ${iss.message}`)
        .join("\n");
      throw new ConfigError(
        `Configuration validation failed for ${configPath}:\n${issueDetails}\nRun 'omnidev config' to repair your configuration.`,
        error
      );
    }
    throw new ConfigError(
      `Unexpected error reading config file at ${configPath}: ${error?.message || error}`,
      error
    );
  }
}

export function saveConfig(config: OmniDevConfig, customPath?: string): void {
  const configPath = getConfigPath(customPath);
  const configDir = path.dirname(configPath);

  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const validated = OmniDevConfigSchema.parse(config);
    fs.writeFileSync(configPath, JSON.stringify(validated, null, 2), {
      encoding: "utf-8",
      mode: 0o600, // Secure read/write only for owner
    });
  } catch (error: any) {
    throw new ConfigError(
      `Failed to save configuration to ${configPath}: ${error?.message || error}`,
      error
    );
  }
}

export function maskApiKey(key: string): string {
  if (!key || key.length <= 8) {
    return "********";
  }
  const prefix = key.slice(0, 4);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}

export function getMaskedConfig(config: OmniDevConfig): Record<string, any> {
  return {
    defaultProvider: config.defaultProvider,
    providers: {
      gemini: {
        model: config.providers.gemini.model,
        keys: config.providers.gemini.keys.map(maskApiKey),
      },
      openai: {
        model: config.providers.openai.model,
        keys: config.providers.openai.keys.map(maskApiKey),
      },
      anthropic: {
        model: config.providers.anthropic.model,
        keys: config.providers.anthropic.keys.map(maskApiKey),
      },
      ollama: {
        model: config.providers.ollama.model,
        baseUrl: config.providers.ollama.baseUrl,
      },
    },
  };
}
