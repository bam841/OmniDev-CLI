import { z } from "zod";

export const SupportedProviderEnum = z.enum(["gemini", "openai", "anthropic", "ollama"]);
export type SupportedProvider = z.infer<typeof SupportedProviderEnum>;

export const CloudProviderConfigSchema = z.object({
  model: z.string().min(1),
  keys: z.array(z.string()).default([]),
});
export type CloudProviderConfig = z.infer<typeof CloudProviderConfigSchema>;

export const OllamaProviderConfigSchema = z.object({
  model: z.string().min(1).default("llama3"),
  baseUrl: z.string().url().default("http://localhost:11434"),
});
export type OllamaProviderConfig = z.infer<typeof OllamaProviderConfigSchema>;

export const OmniDevConfigSchema = z.object({
  defaultProvider: SupportedProviderEnum.default("gemini"),
  providers: z.object({
    gemini: CloudProviderConfigSchema.default({
      model: "gemini-1.5-pro-latest",
      keys: [],
    }),
    openai: CloudProviderConfigSchema.default({
      model: "gpt-4o",
      keys: [],
    }),
    anthropic: CloudProviderConfigSchema.default({
      model: "claude-3-5-sonnet-20241022",
      keys: [],
    }),
    ollama: OllamaProviderConfigSchema.default({
      model: "llama3",
      baseUrl: "http://localhost:11434",
    }),
  }),
});

export type OmniDevConfig = z.infer<typeof OmniDevConfigSchema>;

export const DEFAULT_CONFIG: OmniDevConfig = {
  defaultProvider: "gemini",
  providers: {
    gemini: {
      model: "gemini-1.5-pro-latest",
      keys: [],
    },
    openai: {
      model: "gpt-4o",
      keys: [],
    },
    anthropic: {
      model: "claude-3-5-sonnet-20241022",
      keys: [],
    },
    ollama: {
      model: "llama3",
      baseUrl: "http://localhost:11434",
    },
  },
};
