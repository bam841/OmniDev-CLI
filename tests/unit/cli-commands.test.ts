import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createProgram } from "../../src/index.js";
import { loadConfig } from "../../src/core/config/manager.js";

describe("CLI Subcommands Registration", () => {
  it("registers config, plan, code, and review subcommands", () => {
    const program = createProgram();
    const commandNames = program.commands.map((cmd) => cmd.name());
    expect(commandNames).toContain("config");
    expect(commandNames).toContain("plan");
    expect(commandNames).toContain("code");
    expect(commandNames).toContain("review");
  });

  it("verifies plan command arguments and options", () => {
    const program = createProgram();
    const planCmd = program.commands.find((c) => c.name() === "plan");
    expect(planCmd).toBeDefined();
    expect(planCmd?.description()).toContain("execution roadmap");
  });

  it("verifies code command options", () => {
    const program = createProgram();
    const codeCmd = program.commands.find((c) => c.name() === "code");
    expect(codeCmd).toBeDefined();
    const options = codeCmd?.options.map((o) => o.long);
    expect(options).toContain("--step");
    expect(options).toContain("--all");
  });

  it("verifies review command options", () => {
    const program = createProgram();
    const reviewCmd = program.commands.find((c) => c.name() === "review");
    expect(reviewCmd).toBeDefined();
    const options = reviewCmd?.options.map((o) => o.long);
    expect(options).toContain("--staged");
  });
});

describe("Config Command Action Integration", () => {
  let tempDir: string;
  let tempConfigPath: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omnidev-cli-test-"));
    tempConfigPath = path.join(tempDir, "config.json");
    originalEnv = process.env.OMNIDEV_CONFIG_PATH;
    process.env.OMNIDEV_CONFIG_PATH = tempConfigPath;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.OMNIDEV_CONFIG_PATH = originalEnv;
    } else {
      delete process.env.OMNIDEV_CONFIG_PATH;
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("executes config --set-provider and updates config file", async () => {
    const cli = createProgram();
    await cli.parseAsync(["node", "omnidev", "config", "--set-provider", "anthropic"]);
    const config = loadConfig(tempConfigPath);
    expect(config.defaultProvider).toBe("anthropic");
  });

  it("executes config --add-key and adds key to array", async () => {
    const cli = createProgram();
    await cli.parseAsync(["node", "omnidev", "config", "--add-key", "openai", "sk-unit-test-1234"]);
    const config = loadConfig(tempConfigPath);
    expect(config.providers.openai.keys).toContain("sk-unit-test-1234");
  });

  it("executes config --reset and restores default config", async () => {
    const cli1 = createProgram();
    await cli1.parseAsync(["node", "omnidev", "config", "--set-provider", "openai"]);
    expect(loadConfig(tempConfigPath).defaultProvider).toBe("openai");

    const cli2 = createProgram();
    await cli2.parseAsync(["node", "omnidev", "config", "--reset"]);
    expect(loadConfig(tempConfigPath).defaultProvider).toBe("gemini");
  });
});
