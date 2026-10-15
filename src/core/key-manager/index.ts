import { type SupportedProvider, type OmniDevConfig } from "../config/schema.js";
import { loadConfig, maskApiKey } from "../config/manager.js";
import {
  type ResolvedKey,
  type KeyStatus,
  type KeySource,
  NoKeysAvailableError,
  AllKeysCoolingDownError,
} from "./types.js";

interface InternalKeyItem {
  key: string;
  source: KeySource;
}

export class KeyManager {
  private cooldowns: Map<string, number> = new Map();
  private pointerIndices: Map<SupportedProvider, number> = new Map();
  private configOverride?: OmniDevConfig;

  constructor(configOverride?: OmniDevConfig) {
    this.configOverride = configOverride;
  }

  private getConfig(): OmniDevConfig {
    return this.configOverride || loadConfig();
  }

  public setConfig(config: OmniDevConfig): void {
    this.configOverride = config;
  }

  /**
   * Resolves all available keys for a provider from config and environment variables.
   */
  public getCandidateKeys(provider: SupportedProvider): InternalKeyItem[] {
    if (provider === "ollama") {
      return [{ key: "local-ollama-noop", source: "config" }];
    }

    const config = this.getConfig();
    const result: InternalKeyItem[] = [];
    const seen = new Set<string>();

    // 1. Check configured keys in ~/.omnidev/config.json
    const cloudConfig = config.providers[provider];
    if (cloudConfig && "keys" in cloudConfig && Array.isArray(cloudConfig.keys)) {
      for (const k of cloudConfig.keys) {
        const trimmed = k.trim();
        if (trimmed && !seen.has(trimmed)) {
          result.push({ key: trimmed, source: "config" });
          seen.add(trimmed);
        }
      }
    }

    // 2. Fall back to environment variables
    const envKeys = this.getEnvKeys(provider);
    for (const envKey of envKeys) {
      const trimmed = envKey.trim();
      if (trimmed && !seen.has(trimmed)) {
        result.push({ key: trimmed, source: "env" });
        seen.add(trimmed);
      }
    }

    return result;
  }

  private getEnvKeys(provider: SupportedProvider): string[] {
    const keys: string[] = [];
    if (provider === "gemini") {
      if (process.env.GEMINI_API_KEY) keys.push(process.env.GEMINI_API_KEY);
      if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) keys.push(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    } else if (provider === "openai") {
      if (process.env.OPENAI_API_KEY) keys.push(process.env.OPENAI_API_KEY);
    } else if (provider === "anthropic") {
      if (process.env.ANTHROPIC_API_KEY) keys.push(process.env.ANTHROPIC_API_KEY);
    }
    return keys;
  }

  /**
   * Checks whether a specific key is currently cooling down from a 429 error.
   */
  public isCoolingDown(key: string): boolean {
    const expiresAt = this.cooldowns.get(key);
    if (!expiresAt) return false;
    if (Date.now() >= expiresAt) {
      this.cooldowns.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Marks a key as rate-limited with an in-memory cooldown duration in seconds (default 60s).
   */
  public markRateLimited(provider: SupportedProvider, key: string, cooldownSec: number = 60): void {
    const expiresAt = Date.now() + cooldownSec * 1000;
    this.cooldowns.set(key, expiresAt);
  }

  /**
   * Retrieves the next available unblocked key for a provider using round-robin rotation.
   */
  public getNextKey(provider: SupportedProvider): ResolvedKey {
    if (provider === "ollama") {
      return { key: "local-ollama-noop", source: "config", provider: "ollama" };
    }

    const candidates = this.getCandidateKeys(provider);
    if (candidates.length === 0) {
      throw new NoKeysAvailableError(provider);
    }

    const total = candidates.length;
    let startIndex = this.pointerIndices.get(provider) || 0;
    if (startIndex >= total) {
      startIndex = 0;
    }

    // Try finding the first key that is not in cooldown
    for (let i = 0; i < total; i++) {
      const checkIndex = (startIndex + i) % total;
      const candidate = candidates[checkIndex];

      if (!this.isCoolingDown(candidate.key)) {
        // Advance pointer for next round-robin call
        this.pointerIndices.set(provider, (checkIndex + 1) % total);
        return {
          key: candidate.key,
          source: candidate.source,
          provider,
        };
      }
    }

    // All keys are currently in cooldown: calculate the earliest expiration time
    let minRemainingMs = Infinity;
    const now = Date.now();
    for (const candidate of candidates) {
      const expiresAt = this.cooldowns.get(candidate.key) || now;
      const diff = Math.max(0, expiresAt - now);
      if (diff < minRemainingMs) {
        minRemainingMs = diff;
      }
    }

    const minSec = Math.ceil(minRemainingMs / 1000);
    throw new AllKeysCoolingDownError(provider, minSec);
  }

  /**
   * Returns inspection statuses for all known keys for a provider.
   */
  public getKeyStatus(provider: SupportedProvider): KeyStatus[] {
    const candidates = this.getCandidateKeys(provider);
    const now = Date.now();

    return candidates.map((cand) => {
      const expiresAt = this.cooldowns.get(cand.key);
      const isCooldown = expiresAt ? expiresAt > now : false;
      const remaining = isCooldown && expiresAt ? Math.ceil((expiresAt - now) / 1000) : 0;

      return {
        key: cand.key,
        masked: maskApiKey(cand.key),
        isCoolingDown: isCooldown,
        cooldownRemainingSec: remaining,
        source: cand.source,
      };
    });
  }

  /**
   * Resets all active cooldowns.
   */
  public clearCooldowns(): void {
    this.cooldowns.clear();
  }
}

export const defaultKeyManager = new KeyManager();
