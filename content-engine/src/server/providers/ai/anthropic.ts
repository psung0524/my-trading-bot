import Anthropic from "@anthropic-ai/sdk";
import { AIProviderError, type AIProvider, type GenerateInput, type GenerateOutput } from "./types";
import { toJsonSchema } from "./json-schema";

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  constructor(apiKey: string, private model: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateStructured<T>(input: GenerateInput<T>): Promise<GenerateOutput<T>> {
    const tool = {
      name: input.schemaName,
      description: `Return the result as a ${input.schemaName} object.`,
      input_schema: toJsonSchema(input.schema) as Anthropic.Tool["input_schema"],
    };
    const userContent = `${input.user}\n\n[컨텍스트 JSON]\n${JSON.stringify(input.context, null, 2)}`;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.client.messages.create({
          model: this.model,
          max_tokens: input.maxTokens ?? 4096,
          system: input.system,
          tools: [tool],
          tool_choice: { type: "tool", name: input.schemaName },
          messages: [
            { role: "user", content: attempt === 0 ? userContent : `${userContent}\n\n이전 응답이 스키마 검증에 실패했습니다: ${String(lastError)}. 스키마를 정확히 지켜 다시 생성하세요.` },
          ],
        });
        const block = res.content.find((c) => c.type === "tool_use");
        if (!block || block.type !== "tool_use") throw new Error("tool_use 응답이 없습니다");
        const parsed = input.schema.safeParse(block.input);
        if (!parsed.success) {
          lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
          continue;
        }
        return {
          data: parsed.data,
          raw: JSON.stringify(block.input),
          provider: this.name,
          model: this.model,
          usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
        };
      } catch (e) {
        lastError = e;
      }
    }
    throw new AIProviderError(`Anthropic 생성 실패: ${String(lastError)}`, lastError);
  }
}
