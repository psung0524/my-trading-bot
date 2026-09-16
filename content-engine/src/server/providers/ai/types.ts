import type { z } from "zod";

export type GenerateInput<T> = {
  /** 프롬프트 키 (예: threads.generate) */
  promptKey: string;
  promptVersion: number;
  /** 채널별 지시. sharedSystem이 있으면 그 뒤에 붙는다 */
  system: string;
  user: string;
  schema: z.ZodType<T>;
  schemaName: string;
  /** 호출마다 달라지는 컨텍스트(옵션, 예문 등). user 프롬프트에 포함된다 */
  context: Record<string, unknown>;
  /** 여러 호출이 공유하는 고정 규칙(공통 규칙). 프롬프트 캐시 접두사로 쓰인다 */
  sharedSystem?: string;
  /** 여러 호출이 공유하는 고정 컨텍스트(Master, 브랜드, 제품). 캐시 접두사로 쓰인다 */
  stableContext?: Record<string, unknown>;
  maxTokens?: number;
};

export type Usage = { inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number; batch?: boolean };

export type GenerateOutput<T> = {
  data: T;
  raw: string;
  provider: string;
  model: string;
  usage?: Usage;
};

/** 배치 제출 항목. customId로 결과를 되찾는다 */
export type BatchRequest = { customId: string; input: GenerateInput<unknown> };
export type BatchResultItem = { customId: string; ok: true; raw: unknown; usage?: Usage; model: string } | { customId: string; ok: false; error: string };
export type BatchStatus = { ended: boolean; counts?: { processing: number; succeeded: number; errored: number } ; results?: BatchResultItem[] };

export interface AIProvider {
  readonly name: string;
  generateStructured<T>(input: GenerateInput<T>): Promise<GenerateOutput<T>>;
  /** 배치 API(약 50% 저렴, 비동기). 지원하지 않는 Provider는 구현하지 않는다 */
  submitBatch?(requests: BatchRequest[]): Promise<{ batchId: string }>;
  fetchBatch?(batchId: string): Promise<BatchStatus>;
}

export class AIProviderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AIProviderError";
  }
}
