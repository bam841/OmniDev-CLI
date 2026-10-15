import { describe, it, expect } from "vitest";
import { program } from "../../src/index";

describe("OmniDev CLI Entrypoint", () => {
  it("initializes program with correct name and description", () => {
    expect(program.name()).toBe("omnidev");
    expect(program.description()).toContain("Autonomous multi-agent CLI");
    expect(program.version()).toBe("0.1.0");
  });
});
