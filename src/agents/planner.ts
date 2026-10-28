import crypto from "node:crypto";
import { LLMRouter, defaultRouter } from "../core/llm/router.js";
import { scanRepositoryTree } from "../core/context/tree.js";
import {
  savePlan,
  saveState,
  saveSitemap,
  parsePlanTasks,
  loadUIBlocksIndex,
  UISitemapSchema,
  type UISitemap,
  type SessionState,
} from "../core/context/state.js";

export interface PlannerOptions {
  prompt: string;
  cwd?: string;
  model?: string;
  router?: LLMRouter;
  ui?: boolean;
  dryRun?: boolean;
  onChunk?: (text: string) => void;
}

export interface PlannerResult {
  planMarkdown: string;
  planPath?: string;
  sitemapPath?: string;
  sitemap?: UISitemap;
  sessionId: string;
  tasksCount: number;
}

export const PLANNER_SYSTEM_PROMPT = `You are OmniDev's Lead Architect Agent.
Your task is to analyze the user's project structure and feature request, then create a clear, step-by-step implementation plan.

Follow these strict rules:
1. Slice tasks vertically: each task should be an implementable, testable unit of work.
2. Structure every task clearly:
   ### Task N: <Descriptive Title>
   - [ ] Task N: <Descriptive Title>
   **Description:** <Detailed explanation of what this task accomplishes>
   **Files to create/modify:** <List of specific file paths relative to project root>
   **Verification:** <Explicit command or check, e.g. \`npm test\` or \`node ...\`>
3. Keep tasks ordered logically so dependencies are built first.
4. Output cleanly in Github Flavored Markdown.`;

export const UI_PLANNER_SYSTEM_PROMPT = `You are OmniDev's Lead Architect & Relume-Style UI Planner Agent.
Your mission is to decompose the user's web application or landing page request into an implementation roadmap AND a structured UI Sitemap (sitemap.json) using open-source, Relume-style Tailwind wireframe blocks at $0 cost.

Follow these strict rules:
1. First, select the most appropriate section blocks from the available UI Block Catalog for each page:
   - Available categories: navbar, hero, features, stats, pricing, testimonials, cta, faq, footer.
   - Tailor all copywriting and props specifically to the user's product/niche.
2. Structure your implementation plan vertically with discrete, testable tasks:
   ### Task N: <Descriptive Title>
   - [ ] Task N: <Descriptive Title>
   **Description:** <Detailed explanation of what this task accomplishes>
   **Files to create/modify:** <List of specific file paths relative to project root>
   **Verification:** <Explicit command or check>
3. In addition to the markdown plan, you MUST output a valid sitemap JSON block wrapped inside \`\`\`sitemap ... \`\`\` conforming to this exact structure:
\`\`\`sitemap
{
  "projectName": "<Project Name>",
  "description": "<Short summary>",
  "pages": [
    {
      "path": "/",
      "title": "<Page Title>",
      "sections": [
        {
          "id": "<block-id e.g. navbar-01, hero-relume-01, features-grid-01, etc.>",
          "category": "<category>",
          "name": "<Human readable section name>",
          "props": {
            // Tailored copywriting and configurations matching the block's props schema
          }
        }
      ]
    }
  ]
}
\`\`\`
4. Keep tasks ordered logically (scaffold section components in src/components/sections/, assemble pages in src/App.tsx or app/page.tsx, verify layout/props).
5. Output cleanly in Github Flavored Markdown.`;

export function extractSitemapFromResponse(text: string): UISitemap | null {
  // 1. Try ```sitemap ... ```
  const sitemapBlockMatch = text.match(/```(?:sitemap|json)\s*\n([\s\S]*?)\n```/i);
  if (sitemapBlockMatch) {
    try {
      const parsed = JSON.parse(sitemapBlockMatch[1]);
      const valid = UISitemapSchema.safeParse(parsed);
      if (valid.success) {
        return valid.data;
      }
    } catch {}
  }

  // 2. Check for any JSON object containing "pages" array
  const jsonMatches = text.match(/\{[\s\S]*?"pages"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/g);
  if (jsonMatches) {
    for (const match of jsonMatches) {
      try {
        const parsed = JSON.parse(match);
        const valid = UISitemapSchema.safeParse(parsed);
        if (valid.success) {
          return valid.data;
        }
      } catch {}
    }
  }

  return null;
}

export function createDefaultFallbackSitemap(prompt: string): UISitemap {
  return {
    projectName: "OmniDev Generated Web App",
    description: `UI Wireframe layout generated for: ${prompt}`,
    pages: [
      {
        path: "/",
        title: "Home",
        sections: [
          {
            id: "navbar-01",
            category: "navbar",
            name: "Classic Header Navigation",
            props: {
              brandName: "OmniDev",
              navLinks: [
                { label: "Features", href: "#features" },
                { label: "Pricing", href: "#pricing" },
                { label: "FAQ", href: "#faq" },
              ],
              ctaText: "Get Started Free",
              ctaHref: "#cta",
            },
          },
          {
            id: "hero-relume-01",
            category: "hero",
            name: "Split Hero with Media",
            props: {
              tagline: "Relume-Style Open Engine",
              heading: prompt.length > 50 ? prompt.slice(0, 50) + "..." : prompt,
              description: "Build clean, production-grade Tailwind wireframes with zero subscription fees.",
              primaryCtaText: "Start Building",
              secondaryCtaText: "Learn More",
              imageUrl: "https://placehold.co/600x400/222/white?text=Wireframe+Preview",
            },
          },
          {
            id: "features-grid-01",
            category: "features",
            name: "Three-Column Feature Cards",
            props: {
              tagline: "Capabilities",
              heading: "Engineered for Velocity",
              subheading: "Everything you need to launch fast with zero paid lock-in.",
              features: [
                { icon: "Sparkles", title: "Free AI Planning", description: "Structured JSON sitemaps generated via free-tier LLMs." },
                { icon: "Layers", title: "Open Block Registry", description: "Standard React + Tailwind components ready to customize." },
                { icon: "Shield", title: "Zero Lock-in", description: "Full ownership of pure TypeScript source code." },
              ],
            },
          },
          {
            id: "cta-banner-01",
            category: "cta",
            name: "Conversion Banner",
            props: {
              heading: "Ready to launch your vision?",
              description: "Deploy wireframes and interactive prototypes without paying for subscriptions.",
              primaryCtaText: "Deploy Now",
              secondaryCtaText: "View Documentation",
            },
          },
          {
            id: "footer-01",
            category: "footer",
            name: "Navigation Footer",
            props: {
              brandName: "OmniDev CLI",
              brandDescription: "Autonomous multi-agent development engine.",
              linkColumns: [
                {
                  title: "Product",
                  links: [
                    { label: "Features", href: "#features" },
                    { label: "Sitemap", href: "#sitemap" },
                  ],
                },
                {
                  title: "Resources",
                  links: [
                    { label: "Documentation", href: "#docs" },
                    { label: "GitHub", href: "https://github.com/bam841/OmniDev-CLI" },
                  ],
                },
              ],
              copyright: "© 2026 OmniDev. Open-source wireframe engine.",
            },
          },
        ],
      },
    ],
  };
}

export async function runPlanner(options: PlannerOptions): Promise<PlannerResult> {
  const cwd = options.cwd || process.cwd();
  const router = options.router || defaultRouter;
  const sessionId = `omnidev-session-${crypto.randomUUID().slice(0, 8)}`;
  const isUIMode = Boolean(options.ui);

  // 1. Gather repository tree context
  const { tree } = scanRepositoryTree({ cwd, maxDepth: 4 });

  let systemPrompt = PLANNER_SYSTEM_PROMPT;
  let userPrompt = `Project Directory Structure:
\`\`\`
${tree}
\`\`\`

User Request:
${options.prompt}

Generate a comprehensive, step-by-step implementation plan following the required task structure.`;

  if (isUIMode) {
    systemPrompt = UI_PLANNER_SYSTEM_PROMPT;
    const blockCatalog = loadUIBlocksIndex(cwd);
    userPrompt = `Project Directory Structure:
\`\`\`
${tree}
\`\`\`

Available Relume-Style UI Wireframe Block Catalog:
\`\`\`json
${JSON.stringify(blockCatalog, null, 2)}
\`\`\`

User Request (UI/Wireframe):
${options.prompt}

Generate:
1. A step-by-step implementation plan (Task 1: Scaffold section components, Task 2: Assemble pages, Task 3: Verification).
2. A complete, valid \`\`\`sitemap JSON block mapping pages to chosen component IDs and tailored copywriting props.`;
  }

  // 2. Invoke LLM
  const planMarkdown = await router.stream({
    system: systemPrompt,
    prompt: userPrompt,
    model: options.model,
    onChunk: options.onChunk,
  });

  const parsedTasks = parsePlanTasks(planMarkdown);
  const totalTasks = parsedTasks.length;

  let planPath: string | undefined;
  let sitemapPath: string | undefined;
  let sitemap: UISitemap | undefined;

  if (isUIMode) {
    sitemap = extractSitemapFromResponse(planMarkdown) || createDefaultFallbackSitemap(options.prompt);
  }

  if (!options.dryRun) {
    planPath = savePlan(planMarkdown, cwd);

    if (sitemap) {
      sitemapPath = saveSitemap(sitemap, cwd);
    }

    const effectiveProvider = router.getEffectiveProvider();
    const modelName = router.getModelName(effectiveProvider, options.model);

    const state: SessionState = {
      sessionId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prompt: options.prompt,
      provider: effectiveProvider,
      model: modelName,
      currentStep: 1,
      totalSteps: totalTasks,
      completedSteps: [],
      status: "planning",
      uiSitemap: sitemap,
    };

    saveState(state, cwd);
  }

  return {
    planMarkdown,
    planPath,
    sitemapPath,
    sitemap,
    sessionId,
    tasksCount: totalTasks,
  };
}
