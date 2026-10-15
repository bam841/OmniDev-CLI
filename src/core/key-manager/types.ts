import { type SupportedProvider } from "../config/schema.js";

export type KeySource = "config" | "env";

export interface ResolvedKey {
  key: string;
  source: KeySource;
  provider: SupportedProvider;
}

export interface KeyStatus {
  key: string;
  masked: string;
  isCoolingDown: boolean;
  cooldownRemainingSec: number;
  source: KeySource;
}

export class NoKeysAvailableError extends Error {
  constructor(public readonly provider: SupportedProvider) {
    const envVarMap: Record<string, string> = {
      gemini: "GEMINI_API_KEY",
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
    };
    const envVar = envVarMap[provider] || "API_KEY";
    super(
      `No API keys available for provider '${provider}'.\n` +
      `Configure keys using 'omnidev config --add-key ${provider} <KEY>' or export ${envVar}=<KEY>.`
    );
    this.name = "NoKeysAvailableError";
  }
}

export class AllKeysCoolingDownError extends Error {
  constructor(
    public readonly provider: SupportedProvider,
    public readonly minRemainingSec: number
  ) {
    super(
      `All API keys for provider '${provider}' are currently rate-limited (HTTP 429).\n` +
      `Estimated cooldown remaining: ~${minRemainingSec} seconds.`
    );
    this.name = "AllKeysCoolingDownError";
  }
}
