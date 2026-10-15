import fs from "node:fs";
import path from "node:path";

export function ensureWithinCwd(targetPath: string, cwd: string = process.cwd()): string {
  const resolvedCwd = path.resolve(cwd);
  const resolvedTarget = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(resolvedCwd, targetPath);

  if (!resolvedTarget.startsWith(resolvedCwd)) {
    throw new Error(
      `Security violation: Target file '${targetPath}' is outside the project workspace ('${resolvedCwd}').`
    );
  }

  return resolvedTarget;
}

export function readFileSafe(targetPath: string, cwd: string = process.cwd()): string | null {
  try {
    const safePath = ensureWithinCwd(targetPath, cwd);
    if (!fs.existsSync(safePath)) return null;
    return fs.readFileSync(safePath, "utf-8");
  } catch (err) {
    return null;
  }
}

export function writeFileSafe(targetPath: string, content: string, cwd: string = process.cwd()): string {
  const safePath = ensureWithinCwd(targetPath, cwd);
  const dir = path.dirname(safePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(safePath, content, "utf-8");
  return safePath;
}
