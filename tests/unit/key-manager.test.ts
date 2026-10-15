import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { KeyManager } from "../../src/core/key-manager/index.js";
import { NoKeysAvailableError, AllKeysCoolingDownError } from "../../src/core/key-manager/types.js";
import type { OmniDevConfig } from "../../src/core/config/schema.js";

describe("KeyManager BYOK Engine", () => {
  let mockConfig: OmniDevConfig;
  let keyManager: KeyManager;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    mockConfig = {
      defaultProvider: "gemini",
      providers: {
        gemini: {
          model: "gemini-1.5-pro",
          keys: ["gemini-key-1", "gemini-key-2", "gemini-key-3"],
        },
        openai: {
          model: "gpt-4o",
          keys: [],
        },
        anthropic: {
          model: "claude-3-5-sonnet",
          keys: ["anthropic-key-1"],
        },
        ollama: {
          model: "llama3",
          baseUrl: "http://localhost:11434",
        },
      },
    };

    keyManager = new KeyManager(mockConfig);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("rotates keys in round-robin sequence", () => {
    const k1 = keyManager.getNextKey("gemini");
    const k2 = keyManager.getNextKey("gemini");
    const k3 = keyManager.getNextKey("gemini");
    const k4 = keyManager.getNextKey("gemini");

    expect(k1.key).toBe("gemini-key-1");
    expect(k2.key).toBe("gemini-key-2");
    expect(k3.key).toBe("gemini-key-3");
    expect(k4.key).toBe("gemini-key-1"); // wraps back around
  });

  it("skips rate-limited keys on cooldown and selects the next unblocked key", () => {
    // Mark gemini-key-1 as rate-limited
    keyManager.markRateLimited("gemini", "gemini-key-1", 60);

    expect(keyManager.isCoolingDown("gemini-key-1")).toBe(true);

    const next = keyManager.getNextKey("gemini");
    expect(next.key).toBe("gemini-key-2");
  });

  it("falls back to environment variable when config keys array is empty", () => {
    process.env.OPENAI_API_KEY = "sk-env-fallback-key";

    const resolved = keyManager.getNextKey("openai");
    expect(resolved.key).toBe("sk-env-fallback-key");
    expect(resolved.source).toBe("env");
  });

  it("throws NoKeysAvailableError when neither config nor env has keys", () => {
    expect(() => keyManager.getNextKey("openai")).toThrow(NoKeysAvailableError);
  });

  it("throws AllKeysCoolingDownError when all provider keys are cooling down", () => {
    keyManager.markRateLimited("gemini", "gemini-key-1", 60);
    keyManager.markRateLimited("gemini", "gemini-key-2", 60);
    keyManager.markRateLimited("gemini", "gemini-key-3", 60);

    expect(() => keyManager.getNextKey("gemini")).toThrow(AllKeysCoolingDownError);
  });

  it("supports Ollama without requiring API keys", () => {
    const resolved = keyManager.getNextKey("ollama");
    expect(resolved.provider).toBe("ollama");
    expect(resolved.key).toBeDefined();
  });

  it("returns inspection statuses with masked keys", () => {
    const statuses = keyManager.getKeyStatus("gemini");
    expect(statuses).toHaveLength(3);
    expect(statuses[0].key).toBe("gemini-key-1");
    expect(statuses[0].masked).not.toBe("gemini-key-1");
    expect(statuses[0].isCoolingDown).toBe(false);
  });
});
