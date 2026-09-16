import { prisma } from "@/server/db/prisma";

/** 100만 토큰당 USD (입력, 출력). 공식 단가표 기준이며 변동될 수 있다 */
const PRICES: Record<string, [number, number]> = {
  "claude-fable-5-1": [10, 50],
  "claude-opus-5": [5, 25],
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-5": [2, 10],
  "claude-sonnet-4-6": [3, 15],
  "claude-haiku-4-5": [1, 5],
  "gpt-5-mini": [0.25, 2],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-5.1": [1.25, 10],
};

/** 캐시 읽기 0.1배, 캐시 쓰기 1.25배(5분 TTL), 배치 0.5배 (Anthropic 공식 단가 규칙) */
export function estimateUsd(model: string, inputTokens: number, outputTokens: number, extra: { cacheReadTokens?: number; cacheWriteTokens?: number; batch?: boolean } = {}): number {
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  if (!key) return 0;
  const [i, o] = PRICES[key];
  const usd = (inputTokens * i + (extra.cacheReadTokens ?? 0) * i * 0.1 + (extra.cacheWriteTokens ?? 0) * i * 1.25 + outputTokens * o) / 1_000_000;
  return extra.batch ? usd * 0.5 : usd;
}

export async function recordAiUsage(input: { workspaceId?: string | null; promptKey: string; provider: string; model: string; inputTokens: number; outputTokens: number; cacheReadTokens?: number; cacheWriteTokens?: number; batch?: boolean }) {
  if (input.provider === "mock") return;
  try {
    const cacheReadTokens = input.cacheReadTokens ?? 0;
    const cacheWriteTokens = input.cacheWriteTokens ?? 0;
    const batch = input.batch ?? false;
    await prisma.aiUsage.create({ data: { workspaceId: input.workspaceId ?? null, promptKey: input.promptKey, provider: input.provider, model: input.model, inputTokens: input.inputTokens, outputTokens: input.outputTokens, cacheReadTokens, cacheWriteTokens, batch, estimatedUsd: estimateUsd(input.model, input.inputTokens, input.outputTokens, { cacheReadTokens, cacheWriteTokens, batch }) } });
  } catch (e) {
    console.warn("AI 사용량 기록 실패", e);
  }
}

export async function usageSummary(workspaceId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await prisma.aiUsage.findMany({ where: { workspaceId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } });
  const total = rows.reduce((a, r) => ({ calls: a.calls + 1, input: a.input + r.inputTokens, output: a.output + r.outputTokens, usd: a.usd + r.estimatedUsd, cacheRead: a.cacheRead + r.cacheReadTokens, cacheWrite: a.cacheWrite + r.cacheWriteTokens, batchCalls: a.batchCalls + (r.batch ? 1 : 0) }), { calls: 0, input: 0, output: 0, usd: 0, cacheRead: 0, cacheWrite: 0, batchCalls: 0 });
  const byKey = new Map<string, { calls: number; input: number; output: number; usd: number }>();
  for (const r of rows) {
    const g = byKey.get(r.promptKey) ?? { calls: 0, input: 0, output: 0, usd: 0 };
    g.calls++; g.input += r.inputTokens; g.output += r.outputTokens; g.usd += r.estimatedUsd;
    byKey.set(r.promptKey, g);
  }
  return { total, byKey: [...byKey.entries()].map(([k, v]) => ({ key: k, ...v })), recent: rows.slice(0, 30) };
}
