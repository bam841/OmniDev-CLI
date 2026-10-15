import { describe, it, expect, vi, beforeEach } from "vitest";
import { isRateLimitError, createModelInstance } from "../../src/core/llm/providers.js";
import { LLMRouter } from "../../src/core/llm/router.js";
import { KeyManager } from "../../src/core/key-manager/index.js";
import type { OmniDevConfig } from "../../src/core/config/schema.js";

describe("LLM Providers & Error Detection", () => {
  it("accurately detects rate-limit errors (429)", () => {
    expect(isRateLimitError({ status: 429 })).toBe(true);
    expect(isRateLimitError({ statusCode: 429 })).toBe(true);
    expect(isRateLimitError({ response: { status: 429 } })).toBe(true);
    expect(isRateLimitError(new Error("Rate limit exceeded: 429 Too Many Requests"))).toBe(true);
    expect(isRateLimitError(new Error("RESOURCE_EXHAUSTED: quota exceeded"))).toBe(true);
  });

  it("rejects non-rate-limit errors", () => {
    expect(isRateLimitError({ status: 401 })).toBe(false);
    expect(isRateLimitError({ statusCode: 500 })).toBe(false);
    expect(isRateLimitError(new Error("Network timeout"))).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
  });

  it("instantiates model instances for all supported providers", () => {
    const gemini = createModelInstance({ provider: "gemini", modelName: "gemini-1.5-pro", apiKey: "fake-key" });
    expect(gemini.modelId).toBe("gemini-1.5-pro");

    const openai = createModelInstance({ provider: "openai", modelName: "gpt-4o", apiKey: "fake-key" });
    expect(openai.modelId).toBe("gpt-4o");

    const anthropic = createModelInstance({ provider: "anthropic", modelName: "claude-3-5-sonnet-20241022", apiKey: "fake-key" });
    expect(anthropic.modelId).toBe("claude-3-5-sonnet-20241022");

    const ollama = createModelInstance({ provider: "ollama", modelName: "llama3", baseUrl: "http://localhost:11434/api" });
    expect(ollama.modelId).toBe("llama3");
  });
});

describe("LLMRouter Rotation on 429 Rate Limits", () => {
  let mockConfig: OmniDevConfig;
  let keyManager: KeyManager;
  let router: LLMRouter;

  beforeEach(() => {
    mockConfig = {
      defaultProvider: "gemini",
      providers: {
        gemini: {
          model: "gemini-1.5-pro",
          keys: ["key-alpha", "key-beta", "key-gamma"],
        },
        openai: { model: "gpt-4o", keys: [] },
        anthropic: { model: "claude-3-5-sonnet", keys: [] },
        ollama: { model: "llama3", baseUrl: "http://localhost:11434" },
      },
    };

    keyManager = new KeyManager(mockConfig);
    router = new LLMRouter(keyManager, mockConfig);
  });

  it("retries on 429 error and succeeds with the next rotated key", async () => {
    let callCount = 0;
    const usedKeys: string[] = [];

    const result = await router.executeWithRotation(
      "gemini",
      "gemini-1.5-pro",
      async (_model, key) => {
        callCount++;
        usedKeys.push(key.key);

        if (callCount === 1) {
          // First key fails with 429
          const err: any = new Error("Quota exceeded for quota metric 'Queries'");
          err.statusCode = 429;
          throw err;
        }

        return "Generation succeeded with key-beta!";
      },
      3
    );

    expect(result).toBe("Generation succeeded with key-beta!");
    expect(callCount).toBe(2);
    expect(usedKeys[0]).toBe("key-alpha");
    expect(usedKeys[1]).toBe("key-beta");
    expect(keyManager.isCoolingDown("key-alpha")).toBe(true);
    expect(keyManager.isCoolingDown("key-beta")).toBe(false);
  });

  it("throws immediately on non-rate-limit errors without rotating keys", async () => {
    let callCount = 0;

    await expect(
      router.executeWithRotation(
        "gemini",
        "gemini-1.5-pro",
        async () => {
          callCount++;
          throw new Error("Invalid schema or prompt structure");
        },
        3
      )
    ).rejects.toThrow("Invalid schema or prompt structure");

    expect(callCount).toBe(1);
    expect(keyManager.isCoolingDown("key-alpha")).toBe(false);
  });

  it("exhausts retries if all keys hit rate limits", async () => {
    await expect(
      router.executeWithRotation(
        "gemini",
        "gemini-1.5-pro",
        async () => {
          const err: any = new Error("429 Too Many Requests");
          err.statusCode = 429;
          throw err;
        },
        3
      )
    ).rejects.toThrow(/Exhausted 3 retry attempts/);
  });
});
