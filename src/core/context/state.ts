import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { z } from "zod";

export const UISectionSchema = z.object({
  id: z.string(),
  blockId: z.string().optional(),
  category: z.string(),
  name: z.string(),
  props: z.record(z.any()).default({}),
});

export type UISection = z.infer<typeof UISectionSchema>;

export const UIPageSchema = z.object({
  path: z.string(),
  title: z.string(),
  sections: z.array(UISectionSchema),
});

export type UIPage = z.infer<typeof UIPageSchema>;

export const UISitemapSchema = z.object({
  projectName: z.string().default("OmniDev App"),
  description: z.string().optional(),
  pages: z.array(UIPageSchema),
});

export type UISitemap = z.infer<typeof UISitemapSchema>;

export const SessionStateSchema = z.object({
  sessionId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  prompt: z.string(),
  provider: z.string(),
  model: z.string(),
  currentStep: z.number().default(1),
  totalSteps: z.number().default(0),
  completedSteps: z.array(z.number()).default([]),
  status: z.enum(["planning", "in_progress", "completed", "reviewed"]).default("planning"),
  uiSitemap: UISitemapSchema.optional(),
});

export type SessionState = z.infer<typeof SessionStateSchema>;

export interface ParsedTask {
  index: number;
  title: string;
  completed: boolean;
  rawText: string;
}

export function getOmniDevDir(cwd: string = process.cwd()): string {
  return path.join(path.resolve(cwd), ".omnidev");
}

export function ensureOmniDevDir(cwd: string = process.cwd()): string {
  const dir = getOmniDevDir(cwd);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Ensure .omnidev is ignored in root .gitignore
  const gitignorePath = path.join(path.resolve(cwd), ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    try {
      const gitignore = fs.readFileSync(gitignorePath, "utf-8");
      if (!gitignore.includes(".omnidev")) {
        fs.appendFileSync(gitignorePath, "\n# OmniDev local session artifacts\n.omnidev/\n");
      }
    } catch {
      // Ignore write errors if gitignore is read-only
    }
  }

  return dir;
}

export function savePlan(planContent: string, cwd: string = process.cwd()): string {
  const dir = ensureOmniDevDir(cwd);
  const planPath = path.join(dir, "plan.md");
  fs.writeFileSync(planPath, planContent, "utf-8");
  return planPath;
}

export function loadPlan(cwd: string = process.cwd()): string | null {
  const planPath = path.join(getOmniDevDir(cwd), "plan.md");
  if (!fs.existsSync(planPath)) return null;
  return fs.readFileSync(planPath, "utf-8");
}

export function saveSitemap(sitemap: UISitemap, cwd: string = process.cwd()): string {
  const dir = ensureOmniDevDir(cwd);
  const sitemapPath = path.join(dir, "sitemap.json");
  const validated = UISitemapSchema.parse(sitemap);
  fs.writeFileSync(sitemapPath, JSON.stringify(validated, null, 2), "utf-8");
  return sitemapPath;
}

export function loadSitemap(cwd: string = process.cwd()): UISitemap | null {
  const sitemapPath = path.join(getOmniDevDir(cwd), "sitemap.json");
  if (!fs.existsSync(sitemapPath)) return null;
  try {
    const raw = fs.readFileSync(sitemapPath, "utf-8");
    return UISitemapSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function loadUIBlocksIndex(cwd: string = process.cwd()): any {
  const pathsToTry = [
    path.join(path.resolve(cwd), ".agents", "skills", "ui-blocks-index.json"),
    path.join(__dirname, "..", "..", "..", ".agents", "skills", "ui-blocks-index.json"),
  ];

  for (const p of pathsToTry) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
      } catch {}
    }
  }

  return {
    version: "1.0.0",
    blocks: [
      {
        id: "navbar-01",
        category: "navbar",
        name: "Classic Header Navigation",
        description: "Sticky navigation bar with logo, navigation links, and CTA button.",
        props: { brandName: "string", navLinks: "Array<{ label: string, href: string }>", ctaText: "string" },
      },
      {
        id: "hero-relume-01",
        category: "hero",
        name: "Split Hero with Media",
        description: "Two-column wireframe hero with tagline, headline, description, dual CTAs, and image placeholder.",
        props: { tagline: "string", heading: "string", description: "string", primaryCtaText: "string", secondaryCtaText: "string" },
      },
      {
        id: "features-grid-01",
        category: "features",
        name: "Three-Column Feature Cards",
        description: "Three-column grid showcasing features with icons and descriptions.",
        props: { heading: "string", subheading: "string", features: "Array<{ title: string, description: string }>" },
      },
      {
        id: "footer-01",
        category: "footer",
        name: "Multi-Column Footer",
        description: "Footer with company description and categorized link columns.",
        props: { brandName: "string", copyright: "string" },
      },
    ],
  };
}

export function saveState(state: SessionState, cwd: string = process.cwd()): void {
  const dir = ensureOmniDevDir(cwd);
  const statePath = path.join(dir, "state.json");
  const validated = SessionStateSchema.parse(state);
  fs.writeFileSync(statePath, JSON.stringify(validated, null, 2), "utf-8");
}

export function loadState(cwd: string = process.cwd()): SessionState | null {
  const statePath = path.join(getOmniDevDir(cwd), "state.json");
  if (!fs.existsSync(statePath)) return null;
  try {
    const raw = fs.readFileSync(statePath, "utf-8");
    return SessionStateSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveReview(reviewContent: string, cwd: string = process.cwd()): string {
  const dir = ensureOmniDevDir(cwd);
  const reviewPath = path.join(dir, "review.md");
  fs.writeFileSync(reviewPath, reviewContent, "utf-8");
  return reviewPath;
}

export function loadReview(cwd: string = process.cwd()): string | null {
  const reviewPath = path.join(getOmniDevDir(cwd), "review.md");
  if (!fs.existsSync(reviewPath)) return null;
  return fs.readFileSync(reviewPath, "utf-8");
}

/**
 * Parses markdown tasks formatted as `- [ ] Task N: ...` or `### Task N: ...`
 */
export function parsePlanTasks(planMarkdown: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = planMarkdown.split("\n");

  const checkboxRegex = /^-\s*\[([ xX])\]\s*(?:Task\s*(\d+):?)?\s*(.*)$/i;
  const headerRegex = /^#{2,4}\s*Task\s*(\d+)[:\s]+(.*)$/i;

  let currentHeaderTaskIndex: number | null = null;
  let currentHeaderTitle = "";

  lines.forEach((line) => {
    const trimmed = line.trim();

    // Check for header style: ### Task 1: Initialize Project
    const headerMatch = trimmed.match(headerRegex);
    if (headerMatch) {
      currentHeaderTaskIndex = parseInt(headerMatch[1], 10);
      currentHeaderTitle = headerMatch[2].trim();
      tasks.push({
        index: currentHeaderTaskIndex,
        title: currentHeaderTitle,
        completed: false,
        rawText: trimmed,
      });
      return;
    }

    // Check for checkbox style: - [ ] Task 1: Initialize Project
    const checkboxMatch = trimmed.match(checkboxRegex);
    if (checkboxMatch) {
      const isCompleted = checkboxMatch[1].toLowerCase() === "x";
      const taskIndex = checkboxMatch[2] ? parseInt(checkboxMatch[2], 10) : tasks.length + 1;
      const title = checkboxMatch[3].trim();

      // Avoid duplicate if header already caught it
      const existing = tasks.find((t) => t.index === taskIndex);
      if (existing) {
        existing.completed = isCompleted;
      } else {
        tasks.push({
          index: taskIndex,
          title,
          completed: isCompleted,
          rawText: trimmed,
        });
      }
    }
  });

  return tasks;
}
