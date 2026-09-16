import Anthropic from "@anthropic-ai/sdk";
import { AIProviderError, type AIProvider, type BatchRequest, type BatchStatus, type GenerateInput, type GenerateOutput, type Usage } from "./types";
import { toJsonSchema } from "./json-schema";

/**
 * Anthropic Messages API. 구조화 출력은 tool_use(스키마 강제)로 받는다.
 * 프롬프트 캐싱: system을 [공통 규칙][고정 컨텍스트][채널 지시] 순으로 나누고 고정 컨텍스트 끝에 cache_control을 둔다.
 * 같은 Master로 5분 안에 다시 호출하면(재생성, 재시도) 앞부분이 캐시에서 읽힌다(읽기 0.1배).
 */
export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  constructor(apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey });
  }

  private buildParams<T>(input: GenerateInput<T>, retryNote?: string): Anthropic.MessageCreateParamsNonStreaming {
    const tool: Anthropic.Tool = {
      name: input.schemaName,
      description: `Return the result as a ${input.schemaName} object.`,
      input_schema: toJsonSchema(input.schema) as Anthropic.Tool["input_schema"],
    };
    const system: Anthropic.TextBlockParam[] = [];
    if (input.sharedSystem) system.push({ type: "text", text: input.sharedSystem });
    if (input.stableContext) system.push({ type: "text", text: `[공통 컨텍스트 JSON]\n${JSON.stringify(input.stableContext, null, 2)}`, cache_control: { type: "ephemeral" } });
    else if (system.length) system[system.length - 1].cache_control = { type: "ephemeral" };
    system.push({ type: "text", text: input.system });
    const userContent = `${input.user}\n\n[컨텍스트 JSON]\n${JSON.stringify(input.context, null, 2)}${retryNote ? `\n\n${retryNote}` : ""}`;
    // Fable/Mythos 계열은 강제 tool_choice를 지원하지 않아 auto + 지시로 대체한다
    const forced = !/^claude-(fable|mythos)/.test(this.model);
    return {
      model: this.model,
      max_tokens: input.maxTokens ?? 4096,
      system,
      tools: [tool],
      tool_choice: forced ? { type: "tool", name: input.schemaName } : { type: "auto" },
      messages: [{ role: "user", content: forced ? userContent : `${userContent}\n\n반드시 ${input.schemaName} 도구를 호출해 결과를 제출하세요.` }],
    };
  }

  private static usageOf(u: Anthropic.Usage, batch = false): Usage {
    return { inputTokens: u.input_tokens, outputTokens: u.output_tokens, cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0, batch };
  }

  async generateStructured<T>(input: GenerateInput<T>): Promise<GenerateOutput<T>> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.client.messages.create(this.buildParams(input, attempt === 0 ? undefined : `이전 응답이 스키마 검증에 실패했습니다: ${String(lastError)}. 스키마를 정확히 지켜 다시 생성하세요.`));
        if (res.stop_reason === "refusal") throw new Error("모델이 요청을 거부했습니다(refusal)");
        const block = res.content.find((c) => c.type === "tool_use");
        if (!block || block.type !== "tool_use") throw new Error("tool_use 응답이 없습니다");
        const parsed = input.schema.safeParse(block.input);
        if (!parsed.success) {
          lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
          continue;
        }
        return { data: parsed.data, raw: JSON.stringify(block.input), provider: this.name, model: this.model, usage: AnthropicProvider.usageOf(res.usage) };
      } catch (e) {
        lastError = e;
      }
    }
    throw new AIProviderError(`Anthropic 생성 실패: ${String(lastError)}`, lastError);
  }

  /** Message Batches: 같은 요청을 50% 가격으로, 결과는 수 분~최대 24시간 뒤 */
  async submitBatch(requests: BatchRequest[]): Promise<{ batchId: string }> {
    const batch = await this.client.messages.batches.create({
      requests: requests.map((r) => ({ custom_id: r.customId, params: this.buildParams(r.input) })),
    });
    return { batchId: batch.id };
  }

  async fetchBatch(batchId: string): Promise<BatchStatus> {
    const batch = await this.client.messages.batches.retrieve(batchId);
    const counts = { processing: batch.request_counts.processing, succeeded: batch.request_counts.succeeded, errored: batch.request_counts.errored + batch.request_counts.canceled + batch.request_counts.expired };
    if (batch.processing_status !== "ended") return { ended: false, counts };
    const results: BatchStatus["results"] = [];
    for await (const r of await this.client.messages.batches.results(batchId)) {
      if (r.result.type === "succeeded") {
        const msg = r.result.message;
        const block = msg.content.find((c) => c.type === "tool_use");
        if (!block || block.type !== "tool_use") results.push({ customId: r.custom_id, ok: false, error: msg.stop_reason === "refusal" ? "모델이 요청을 거부했습니다(refusal)" : "tool_use 응답이 없습니다" });
        else results.push({ customId: r.custom_id, ok: true, raw: block.input, usage: AnthropicProvider.usageOf(msg.usage, true), model: msg.model });
      } else if (r.result.type === "errored") {
        results.push({ customId: r.custom_id, ok: false, error: `${r.result.error.type}: ${JSON.stringify(r.result.error)}` });
      } else {
        results.push({ customId: r.custom_id, ok: false, error: r.result.type });
      }
    }
    return { ended: true, counts, results };
  }
}
