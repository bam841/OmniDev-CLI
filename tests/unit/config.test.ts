import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  loadConfig,
  saveConfig,
  maskApiKey,
  getMaskedConfig,
  ConfigError,
} from "../../src/core/config/manager.js";
import { DEFAULT_CONFIG } from "../../src/core/config/schema.js";

describe("Configuration Manager", () => {
  let tempDir: string;
  let tempConfigPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omnidev-test-"));
    tempConfigPath = path.join(tempDir, "config.json");
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("automatically creates and returns default config if file is missing", () => {
    expect(fs.existsSync(tempConfigPath)).toBe(false);

    const config = loadConfig(tempConfigPath);

    expect(fs.existsSync(tempConfigPath)).toBe(true);
    expect(config.defaultProvider).toBe("gemini");
    expect(config.providers.gemini.model).toBe(DEFAULT_CONFIG.providers.gemini.model);
    expect(config.providers.openai.keys).toEqual([]);
  });

  it("loads and validates existing valid config", () => {
    const customConfig = {
      defaultProvider: "openai" as const,
      providers: {
        gemini: { model: "gemini-1.5-pro", keys: ["test-gemini-key"] },
        openai: { model: "gpt-4o-mini", keys: ["sk-test-12345678"] },
        anthropic: { model: "claude-3-haiku", keys: [] },
        ollama: { model: "llama3", baseUrl: "http://localhost:11434" },
      },
    };

    saveConfig(customConfig, tempConfigPath);
    const loaded = loadConfig(tempConfigPath);

    expect(loaded.defaultProvider).toBe("openai");
    expect(loaded.providers.openai.model).toBe("gpt-4o-mini");
    expect(loaded.providers.openai.keys).toEqual(["sk-test-12345678"]);
  });

  it("throws ConfigError when config contains malformed JSON", () => {
    fs.writeFileSync(tempConfigPath, "{ malformed json", "utf-8");

    expect(() => loadConfig(tempConfigPath)).toThrow(ConfigError);
    expect(() => loadConfig(tempConfigPath)).toThrow(/Invalid JSON format/);
  });

  it("throws ConfigError when config fails schema validation", () => {
    const invalidConfig = {
      defaultProvider: "unknown-provider", // invalid enum
      providers: {},
    };

    fs.writeFileSync(tempConfigPath, JSON.stringify(invalidConfig), "utf-8");

    expect(() => loadConfig(tempConfigPath)).toThrow(ConfigError);
    expect(() => loadConfig(tempConfigPath)).toThrow(/validation failed/);
  });

  it("correctly masks API keys for display", () => {
    expect(maskApiKey("short")).toBe("********");
    expect(maskApiKey("sk-proj-1234567890abcdef")).toBe("sk-p...cdef");
  });

  it("produces masked config representation", () => {
    const sampleConfig = {
      defaultProvider: "gemini" as const,
      providers: {
        gemini: { model: "gemini-1.5-pro", keys: ["AIzaSy1234567890ABCDEF"] },
        openai: { model: "gpt-4o", keys: ["sk-proj-0987654321XYZ"] },
        anthropic: { model: "claude-3-5-sonnet", keys: [] },
        ollama: { model: "llama3", baseUrl: "http://localhost:11434" },
      },
    };

    const masked = getMaskedConfig(sampleConfig);
    expect(masked.providers.gemini.keys[0]).not.toBe("AIzaSy1234567890ABCDEF");
    expect(masked.providers.gemini.keys[0]).toBe("AIza...CDEF");
    expect(masked.providers.openai.keys[0]).toBe("sk-p...1XYZ");
  });
});
