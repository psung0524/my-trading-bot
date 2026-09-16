import { z } from "zod";

/** Zod → JSON Schema (draft 2020-12). 툴 입력/response_format 용 */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const js = z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any" }) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

/** 모델 응답 텍스트에서 JSON 블록을 추출한다 (```json ... ``` 또는 첫 { ~ 마지막 }) */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON을 찾을 수 없습니다");
  return JSON.parse(candidate.slice(start, end + 1));
}
