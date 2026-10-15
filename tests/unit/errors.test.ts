import { describe, it, expect } from "vitest";
import { formatErrorMessage } from "../../src/utils/errors.js";
import { NoKeysAvailableError, AllKeysCoolingDownError } from "../../src/core/key-manager/types.js";
import { ConfigError } from "../../src/core/config/manager.js";

describe("CLI Error Formatting", () => {
  it("formats NoKeysAvailableError with guidance", () => {
    const err = new NoKeysAvailableError("gemini");
    const { title, body } = formatErrorMessage(err);
    expect(title).toBe("Missing API Keys");
    expect(body).toContain("omnidev config --add-key gemini");
  });

  it("formats AllKeysCoolingDownError with remaining seconds", () => {
    const err = new AllKeysCoolingDownError("openai", 45);
    const { title, body } = formatErrorMessage(err);
    expect(title).toBe("Rate Limit Cooldown Active");
    expect(body).toContain("~45 seconds");
  });

  it("formats ConfigError cleanly", () => {
    const err = new ConfigError("Invalid JSON detected");
    const { title, body } = formatErrorMessage(err);
    expect(title).toBe("Configuration Error");
    expect(body).toBe("Invalid JSON detected");
  });

  it("formats network and DNS connection errors", () => {
    const err: any = new Error("getaddrinfo ENOTFOUND api.anthropic.com");
    err.code = "ENOTFOUND";
    const { title, body } = formatErrorMessage(err);
    expect(title).toBe("Network Connection Error");
    expect(body).toContain("check your internet connection");
  });

  it("formats 401 authentication errors", () => {
    const err: any = new Error("Invalid API key provided");
    err.statusCode = 401;
    const { title, body } = formatErrorMessage(err);
    expect(title).toBe("Authentication Failed");
    expect(body).toContain("Run 'omnidev config --add-key");
  });
});
