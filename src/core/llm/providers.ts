import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOllama } from "ollama-ai-provider";
import type { LanguageModelV1 } from "ai";
import type { SupportedProvider } from "../config/schema.js";

export interface CreateModelOptions {
  provider: SupportedProvider;
  modelName: string;
  apiKey?: string;
  baseUrl?: string;
}

export function createModelInstance(options: CreateModelOptions): LanguageModelV1 {
  const { provider, modelName, apiKey, baseUrl } = options;

  switch (provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({
        apiKey: apiKey || "",
      });
      return google(modelName);
    }
    case "openai": {
      const openai = createOpenAI({
        apiKey: apiKey || "",
      });
      return openai(modelName);
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: apiKey || "",
      });
      return anthropic(modelName);
    }
    case "ollama": {
      const ollama = createOllama({
        baseURL: baseUrl || "http://localhost:11434/api",
      });
      return ollama(modelName);
    }
    default: {
      const exhaustiveCheck: never = provider;
      throw new Error(`Unsupported provider: ${exhaustiveCheck}`);
    }
  }
}

export function isRateLimitError(error: unknown): boolean {
  if (!error) return false;

  const err = error as any;

  // Check HTTP status code
  if (err.statusCode === 429 || err.status === 429) {
    return true;
  }

  // Check nested response status
  if (err.response?.status === 429 || err.response?.statusCode === 429) {
    return true;
  }

  // Check error message patterns commonly returned by Gemini / OpenAI / Anthropic
  const message = String(err.message || "").toLowerCase();
  if (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("ratelimit") ||
    message.includes("resource_exhausted") ||
    message.includes("quota exceeded") ||
    message.includes("too many requests")
  ) {
    return true;
  }

  return false;
}
