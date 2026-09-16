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

export function estimateUsd(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  if (!key) return 0;
  const [i, o] = PRICES[key];
  return (inputTokens * i + outputTokens * o) / 1_000_000;
}

export async function recordAiUsage(input: { workspaceId?: string | null; promptKey: string; provider: string; model: string; inputTokens: number; outputTokens: number }) {
  if (input.provider === "mock") return;
  try {
    await prisma.aiUsage.create({ data: { ...input, workspaceId: input.workspaceId ?? null, estimatedUsd: estimateUsd(input.model, input.inputTokens, input.outputTokens) } });
  } catch (e) {
    console.warn("AI 사용량 기록 실패", e);
  }
}

export async function usageSummary(workspaceId: string, days = 30) {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await prisma.aiUsage.findMany({ where: { workspaceId, createdAt: { gte: since } }, orderBy: { createdAt: "desc" } });
  const total = rows.reduce((a, r) => ({ calls: a.calls + 1, input: a.input + r.inputTokens, output: a.output + r.outputTokens, usd: a.usd + r.estimatedUsd }), { calls: 0, input: 0, output: 0, usd: 0 });
  const byKey = new Map<string, { calls: number; input: number; output: number; usd: number }>();
  for (const r of rows) {
    const g = byKey.get(r.promptKey) ?? { calls: 0, input: 0, output: 0, usd: 0 };
    g.calls++; g.input += r.inputTokens; g.output += r.outputTokens; g.usd += r.estimatedUsd;
    byKey.set(r.promptKey, g);
  }
  return { total, byKey: [...byKey.entries()].map(([k, v]) => ({ key: k, ...v })), recent: rows.slice(0, 30) };
}
