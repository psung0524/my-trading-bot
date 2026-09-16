import { prisma } from "@/server/db/prisma";

export type BrandContext = {
  brandName: string;
  tagline: string;
  operatorIdentity: string;
  targetAudience: string;
  contentGoal: string;
  tone: string;
  preferredPhrases: string[];
  forbiddenPhrases: string[];
  ctas: { label: string; url: string; strength: "low" | "medium" | "high" }[];
  colors: { primary: string; secondary: string; accent: string };
  fontFamily: string;
  financeDisclaimer: string;
  channelSettings: Record<string, Record<string, unknown>>;
  customRules: string[];
};

/** 제품의 BrandProfile + 활성 BrandRule + 승인된 BrandLearning을 생성 컨텍스트로 합친다 */
export async function loadBrandContext(workspaceId: string, productId: string): Promise<BrandContext> {
  const product = await prisma.product.findFirst({
    where: { id: productId, workspaceId, deletedAt: null },
    include: { brandProfile: { include: { rules: { where: { enabled: true } } } } },
  });
  if (!product) throw new Error("제품을 찾을 수 없습니다");
  const bp = product.brandProfile;
  const learnings = await prisma.brandLearning.findMany({ where: { workspaceId, status: "ACCEPTED" }, take: 20, orderBy: { updatedAt: "desc" } });
  const rules = bp?.rules ?? [];
  const forbidden = new Set<string>(bp?.forbiddenPhrases ?? []);
  const preferred = new Set<string>(bp?.preferredPhrases ?? []);
  const custom: string[] = [];
  for (const r of rules) {
    if (r.kind === "FORBIDDEN_PHRASE") forbidden.add(r.value);
    else if (r.kind === "PREFERRED_PHRASE") preferred.add(r.value);
    else custom.push(`${r.kind}: ${r.value}`);
  }
  for (const l of learnings) custom.push(`학습: ${l.description}`);
  const ctasRaw = Array.isArray(bp?.ctas) ? (bp.ctas as { label: string; url?: string; strength?: string }[]) : [];
  return {
    brandName: bp?.brandName ?? product.name,
    tagline: bp?.tagline ?? "",
    operatorIdentity: bp?.operatorIdentity ?? "",
    targetAudience: bp?.targetAudience ?? "",
    contentGoal: bp?.contentGoal ?? "",
    tone: bp?.tone ?? "",
    preferredPhrases: [...preferred],
    forbiddenPhrases: [...forbidden],
    ctas: ctasRaw.map((c) => ({ label: c.label, url: c.url || product.url, strength: (c.strength as "low" | "medium" | "high") ?? "medium" })),
    colors: { primary: bp?.primaryColor ?? "#0F766E", secondary: bp?.secondaryColor ?? "#F0FDFA", accent: bp?.accentColor ?? "#F59E0B" },
    fontFamily: bp?.fontFamily ?? "Pretendard",
    financeDisclaimer: bp?.financeDisclaimer ?? "",
    channelSettings: (bp?.channelSettings as Record<string, Record<string, unknown>>) ?? {},
    customRules: custom,
  };
}
