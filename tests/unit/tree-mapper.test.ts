import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { scanRepositoryTree } from "../../src/core/context/tree.js";

describe("Repository Tree Mapper", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omnidev-tree-test-"));

    // Create a mock directory structure
    fs.mkdirSync(path.join(tempDir, "src", "core"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "node_modules", "some-pkg"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, ".git"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "dist"), { recursive: true });
    fs.mkdirSync(path.join(tempDir, "secret-folder"), { recursive: true });

    fs.writeFileSync(path.join(tempDir, "src", "index.ts"), "console.log('hi');");
    fs.writeFileSync(path.join(tempDir, "src", "core", "app.ts"), "export const a = 1;");
    fs.writeFileSync(path.join(tempDir, "package.json"), "{}");
    fs.writeFileSync(path.join(tempDir, "node_modules", "some-pkg", "index.js"), "");
    fs.writeFileSync(path.join(tempDir, "dist", "bundle.js"), "");
    fs.writeFileSync(path.join(tempDir, "secret-folder", "pass.txt"), "1234");
    fs.writeFileSync(path.join(tempDir, "ignored-file.tmp"), "temp");

    // Add .gitignore
    fs.writeFileSync(
      path.join(tempDir, ".gitignore"),
      "secret-folder/\n*.tmp\n"
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("filters default ignored directories (node_modules, .git, dist)", () => {
    const result = scanRepositoryTree({ cwd: tempDir });

    expect(result.files).toContain(path.join("src", "index.ts"));
    expect(result.files).toContain(path.join("src", "core", "app.ts"));
    expect(result.files).toContain("package.json");

    expect(result.files).not.toContain(path.join("node_modules", "some-pkg", "index.js"));
    expect(result.files).not.toContain(path.join("dist", "bundle.js"));
    expect(result.tree).not.toContain("node_modules");
  });

  it("respects project .gitignore entries", () => {
    const result = scanRepositoryTree({ cwd: tempDir });

    expect(result.files).not.toContain(path.join("secret-folder", "pass.txt"));
    expect(result.files).not.toContain("ignored-file.tmp");
    expect(result.tree).not.toContain("secret-folder");
  });

  it("respects maxDepth limits", () => {
    const result = scanRepositoryTree({ cwd: tempDir, maxDepth: 1 });
    expect(result.tree).toContain("max depth reached");
    expect(result.files).not.toContain(path.join("src", "core", "app.ts"));
  });
});
