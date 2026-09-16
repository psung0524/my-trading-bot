import { MockAIProvider } from "./mock";
import { AnthropicProvider } from "./anthropic";
import { OpenAIProvider } from "./openai";
import type { AIProvider, GenerateInput, GenerateOutput } from "./types";
import { recordAiUsage } from "./usage";

export type { AIProvider, GenerateInput, GenerateOutput } from "./types";
export { AIProviderError } from "./types";

let cached: AIProvider | null = null;

/** 사용량 기록 래퍼: 호출마다 토큰과 예상 비용을 AiUsage에 남긴다 (context.workspaceId 또는 input.workspaceId 사용) */
function withUsage(inner: AIProvider): AIProvider {
  return {
    name: inner.name,
    async generateStructured<T>(input: GenerateInput<T>): Promise<GenerateOutput<T>> {
      const out = await inner.generateStructured(input);
      const wsId = (input as GenerateInput<T> & { workspaceId?: string }).workspaceId ?? (typeof input.context.workspaceId === "string" ? input.context.workspaceId : null);
      await recordAiUsage({ workspaceId: wsId, promptKey: input.promptKey, provider: out.provider, model: out.model, inputTokens: out.usage?.inputTokens ?? 0, outputTokens: out.usage?.outputTokens ?? 0 });
      return out;
    },
  };
}

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
  cached = withUsage(cached);
  return cached;
}

export function resetAIProviderCache() {
  cached = null;
}
