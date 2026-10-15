import { generateText, streamText, type LanguageModelV1 } from "ai";
import { type SupportedProvider, type OmniDevConfig } from "../config/schema.js";
import { loadConfig } from "../config/manager.js";
import { KeyManager, defaultKeyManager } from "../key-manager/index.js";
import { type ResolvedKey, AllKeysCoolingDownError, NoKeysAvailableError } from "../key-manager/types.js";
import { createModelInstance, isRateLimitError } from "./providers.js";
import { log } from "../../utils/ui.js";

export interface LLMRequestOptions {
  prompt: string;
  system?: string;
  provider?: SupportedProvider;
  model?: string;
  maxRetries?: number;
}

export interface LLMStreamOptions extends LLMRequestOptions {
  onChunk?: (text: string) => void;
}

export class LLMRouter {
  private keyManager: KeyManager;
  private configOverride?: OmniDevConfig;

  constructor(keyManager: KeyManager = defaultKeyManager, configOverride?: OmniDevConfig) {
    this.keyManager = keyManager;
    this.configOverride = configOverride;
  }

  private getConfig(): OmniDevConfig {
    return this.configOverride || loadConfig();
  }

  public getEffectiveProvider(providerOverride?: SupportedProvider): SupportedProvider {
    return providerOverride || this.getConfig().defaultProvider;
  }

  public getModelName(provider: SupportedProvider, modelOverride?: string): string {
    if (modelOverride) return modelOverride;
    const config = this.getConfig();
    return config.providers[provider].model;
  }

  /**
   * Executes an LLM operation with automatic 429 rate-limit handling and key rotation.
   */
  public async executeWithRotation<T>(
    provider: SupportedProvider,
    modelName: string,
    operation: (model: LanguageModelV1, key: ResolvedKey) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    const config = this.getConfig();
    const baseUrl = provider === "ollama" ? config.providers.ollama.baseUrl : undefined;

    let attempts = 0;
    let lastError: unknown;

    while (attempts < maxRetries) {
      attempts++;
      let resolvedKey: ResolvedKey;

      try {
        resolvedKey = this.keyManager.getNextKey(provider);
      } catch (err) {
        if (err instanceof AllKeysCoolingDownError || err instanceof NoKeysAvailableError) {
          throw err;
        }
        throw err;
      }

      const model = createModelInstance({
        provider,
        modelName,
        apiKey: resolvedKey.key,
        baseUrl,
      });

      try {
        return await operation(model, resolvedKey);
      } catch (error: any) {
        lastError = error;

        if (isRateLimitError(error)) {
          log.warn(`Rate limit (429) hit on key for '${provider}'. Rotating to next available key...`);
          this.keyManager.markRateLimited(provider, resolvedKey.key, 60);

          if (attempts >= maxRetries) {
            break;
          }
          continue;
        }

        // For non-rate-limit errors, do not rotate keys; throw immediately
        throw error;
      }
    }

    throw new Error(
      `Exhausted ${maxRetries} retry attempts for provider '${provider}' due to repeated rate limits.\n` +
      `Error details: ${lastError instanceof Error ? lastError.message : String(lastError)}`
    );
  }

  /**
   * Performs complete non-streaming text generation.
   */
  public async generate(options: LLMRequestOptions): Promise<string> {
    const provider = this.getEffectiveProvider(options.provider);
    const modelName = this.getModelName(provider, options.model);

    return this.executeWithRotation(
      provider,
      modelName,
      async (model) => {
        const result = await generateText({
          model,
          system: options.system,
          prompt: options.prompt,
        });
        return result.text;
      },
      options.maxRetries || 3
    );
  }

  /**
   * Streams generated text chunk-by-chunk and returns the accumulated string.
   */
  public async stream(options: LLMStreamOptions): Promise<string> {
    const provider = this.getEffectiveProvider(options.provider);
    const modelName = this.getModelName(provider, options.model);

    return this.executeWithRotation(
      provider,
      modelName,
      async (model) => {
        const result = streamText({
          model,
          system: options.system,
          prompt: options.prompt,
        });

        let fullText = "";
        for await (const chunk of result.textStream) {
          fullText += chunk;
          if (options.onChunk) {
            options.onChunk(chunk);
          }
        }
        return fullText;
      },
      options.maxRetries || 3
    );
  }
}

export const defaultRouter = new LLMRouter();
