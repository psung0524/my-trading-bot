import OpenAI from "openai";
import { AIProviderError, type AIProvider, type GenerateInput, type GenerateOutput } from "./types";
import { extractJson, toJsonSchema } from "./json-schema";

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: OpenAI;
  constructor(apiKey: string, private model: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateStructured<T>(input: GenerateInput<T>): Promise<GenerateOutput<T>> {
    const userContent = `${input.user}\n\n[컨텍스트 JSON]\n${JSON.stringify(input.context, null, 2)}`;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.client.chat.completions.create({
          model: this.model,
          max_tokens: input.maxTokens ?? 4096,
          response_format: {
            type: "json_schema",
            json_schema: { name: input.schemaName, schema: toJsonSchema(input.schema), strict: false },
          },
          messages: [
            { role: "system", content: input.system },
            { role: "user", content: attempt === 0 ? userContent : `${userContent}\n\n이전 응답 오류: ${String(lastError)}. 스키마를 지켜 다시 생성하세요.` },
          ],
        });
        const text = res.choices[0]?.message?.content ?? "";
        const parsed = input.schema.safeParse(extractJson(text));
        if (!parsed.success) {
          lastError = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
          continue;
        }
        return {
          data: parsed.data,
          raw: text,
          provider: this.name,
          model: this.model,
          usage: res.usage ? { inputTokens: res.usage.prompt_tokens, outputTokens: res.usage.completion_tokens } : undefined,
        };
      } catch (e) {
        lastError = e;
      }
    }
    throw new AIProviderError(`OpenAI 생성 실패: ${String(lastError)}`, lastError);
  }
}
