import type { z } from "zod";

export type GenerateInput<T> = {
  /** 프롬프트 키 (예: threads.generate) */
  promptKey: string;
  promptVersion: number;
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
  /** 구조화 컨텍스트. 실제 Provider는 user 프롬프트에 포함되고, Mock은 이것으로 결과를 만든다 */
  context: Record<string, unknown>;
  maxTokens?: number;
};

export type GenerateOutput<T> = {
  data: T;
  raw: string;
  provider: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
};

export interface AIProvider {
  readonly name: string;
  generateStructured<T>(input: GenerateInput<T>): Promise<GenerateOutput<T>>;
}

export class AIProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AIProviderError";
  }
}
