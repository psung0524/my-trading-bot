import { MockAIProvider } from "./mock";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import type { AIProvider } from "./types";

export type { AIProvider, GenerateInput, GenerateOutput } from "./types";
export { AIProviderError } from "./types";

let cached: AIProvider | null = null;

/** AI_PROVIDER 환경변수로 선택. 키가 없으면 Mock으로 폴백하고 경고를 남긴다. */
export function getAIProvider(): AIProvider {
  if (cached) return cached;
  const mode = process.env.AI_PROVIDER ?? "mock";
  if (mode === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    cached = new AnthropicProvider(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL || "claude-sonnet-5");
  } else if (mode === "openai" && process.env.OPENAI_API_KEY) {
    cached = new OpenAIProvider(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL || "gpt-4.1-mini");
  } else {
    if (mode !== "mock") console.warn(`AI_PROVIDER=${mode}이지만 API 키가 없어 Mock을 사용합니다`);
    cached = new MockAIProvider();
  }
  return cached;
}

export function resetAIProviderCache() {
  cached = null;
}
