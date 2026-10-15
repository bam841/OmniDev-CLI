import fs from "node:fs";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

export interface ScanTreeOptions {
  cwd?: string;
  maxDepth?: number;
  customIgnores?: string[];
}

export interface TreeScanResult {
  tree: string;
  files: string[];
}

const DEFAULT_IGNORED_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".omnidev",
  ".DS_Store",
  "*.log",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "*.lock",
  ".env",
  ".env.*",
];

export function getIgnoreFilter(cwd: string, customIgnores: string[] = []): Ignore {
  const ig = ignore();
  ig.add(DEFAULT_IGNORED_PATTERNS);
  ig.add(customIgnores);

  const gitignorePath = path.join(cwd, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    try {
      const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
      ig.add(gitignoreContent);
    } catch {
      // Ignore reading error if unreadable
    }
  }

  return ig;
}

export function scanRepositoryTree(options: ScanTreeOptions = {}): TreeScanResult {
  const cwd = path.resolve(options.cwd || process.cwd());
  const maxDepth = options.maxDepth ?? 5;
  const ig = getIgnoreFilter(cwd, options.customIgnores);

  const fileList: string[] = [];
  const lines: string[] = [path.basename(cwd) + "/"];

  function traverse(dir: string, prefix: string, currentDepth: number) {
    if (currentDepth > maxDepth) {
      lines.push(`${prefix}└── ... (max depth reached)`);
      return;
    }

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    // Sort folders first, then alphabetical
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    // Filter ignored entries
    const validEntries = entries.filter((entry) => {
      const relativePath = path.relative(cwd, path.join(dir, entry.name));
      const testPath = entry.isDirectory() ? `${relativePath}/` : relativePath;
      return !ig.ignores(testPath);
    });

    validEntries.forEach((entry, index) => {
      const isLast = index === validEntries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const relativePath = path.relative(cwd, path.join(dir, entry.name));

      if (entry.isDirectory()) {
        lines.push(`${prefix}${connector}${entry.name}/`);
        const nextPrefix = prefix + (isLast ? "    " : "│   ");
        traverse(path.join(dir, entry.name), nextPrefix, currentDepth + 1);
      } else {
        lines.push(`${prefix}${connector}${entry.name}`);
        fileList.push(relativePath);
      }
    });
  }

  traverse(cwd, "", 1);

  return {
    tree: lines.join("\n"),
    files: fileList,
  };
}
