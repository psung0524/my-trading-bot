import type { AIProvider, GenerateInput, GenerateOutput } from "./types";
import type { BlogBody, ContentMasterBody, Fact, InstagramBody, ShortsBody, ThreadsBody, TopicCandidate } from "@/lib/schemas/content";

type Brand = {
  brandName?: string;
  tone?: string;
  financeDisclaimer?: string;
  preferredPhrases?: string[];
  ctas?: { label: string; url: string; strength: string }[];
};

/**
 * 결정론적 Mock AI. 컨텍스트의 facts(display)만 사용해 문장을 만든다.
 * 실제 Provider와 동일한 스키마를 만족해야 하며, 데모/E2E에서 사용된다.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";

  async generateStructured<T>(input: GenerateInput<T>): Promise<GenerateOutput<T>> {
    const ctx = input.context;
    let data: unknown;
    switch (input.promptKey) {
      case "topic.discover":
        data = { candidates: mockTopics(ctx) };
        break;
      case "master.generate":
        data = mockMaster(ctx);
        break;
      case "threads.generate":
        data = { posts: mockThreads(ctx) };
        break;
      case "instagram.generate":
        data = mockInstagram(ctx);
        break;
      case "blog.generate":
        data = mockBlog(ctx);
        break;
      case "shorts.generate":
        data = mockShorts(ctx);
        break;
      case "learning.analyze":
        data = mockLearning(ctx);
        break;
      default:
        throw new Error(`Mock AI: 알 수 없는 promptKey ${input.promptKey}`);
    }
    const parsed = input.schema.safeParse(data);
    if (!parsed.success) {
      throw new Error(`Mock AI 스키마 불일치(${input.promptKey}): ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    return { data: parsed.data, raw: JSON.stringify(data), provider: this.name, model: "mock-v1" };
  }
}

// ---------- helpers ----------

function fact(facts: Fact[], key: string): Fact | undefined {
  return facts.find((f) => f.key === key);
}
function disp(f?: Fact) {
  return f?.display || (f ? String(f.value) : "");
}
function brandOf(ctx: Record<string, unknown>): Brand {
  return (ctx.brand as Brand) ?? {};
}
function masterOf(ctx: Record<string, unknown>): ContentMasterBody {
  return ctx.master as ContentMasterBody;
}
function ctaOf(ctx: Record<string, unknown>) {
  const m = masterOf(ctx);
  return m?.cta ?? brandOf(ctx).ctas?.[0] ?? { label: "자세히 보기", url: "", strength: "low" };
}

function isDividendCalc(facts: Fact[]) {
  return Boolean(fact(facts, "monthlyTarget") && fact(facts, "principal1"));
}

function scenarioLines(facts: Fact[]) {
  const lines: { yieldText: string; principalText: string; yieldKey: string; principalKey: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    const y = fact(facts, `yield${i}`);
    const p = fact(facts, `principal${i}`);
    if (!y || !p) break;
    lines.push({ yieldText: disp(y), principalText: disp(p), yieldKey: y.key, principalKey: p.key });
  }
  return lines;
}

// ---------- topic discovery ----------

function mockTopics(ctx: Record<string, unknown>): TopicCandidate[] {
  const sourceType = String(ctx.sourceType ?? "TREND");
  const product = (ctx.product as { name?: string }) ?? {};
  const base: Record<string, TopicCandidate[]> = {
    TREND: [
      { title: "월배당 ETF, 분배금 기준일을 확인해야 하는 이유", coreQuestion: "분배금 기준일과 지급일은 어떻게 다를까?", targetAudience: "월배당 ETF에 관심 있는 초보 투자자", purpose: "정보 제공", category: "INFORMATIONAL", expectedChannels: ["THREADS", "BLOG"], riskLevel: "LOW", expectedTypes: ["설명형"], evidence: { note: "Mock 트렌드 데이터" }, sources: [] },
      { title: "배당수익률 5%는 높은 걸까? 기준을 정하는 방법", coreQuestion: "배당수익률 숫자 하나로 판단하면 안 되는 이유", targetAudience: "배당수익률만 보고 고르는 투자자", purpose: "정보 제공", category: "INFORMATIONAL", expectedChannels: ["THREADS", "INSTAGRAM"], riskLevel: "MEDIUM", expectedTypes: ["체크리스트형"], evidence: { note: "Mock 트렌드 데이터" }, sources: [] },
    ],
    FREQUENTLY_VIEWED: [
      { title: `${product.name ?? "서비스"}에서 가장 많이 본 계산: 월 100만 원 배당`, coreQuestion: "월 100만 원 배당을 받으려면 얼마가 필요할까?", targetAudience: "목표 배당금을 정한 투자자", purpose: "데이터 제공", category: "DATA", expectedChannels: ["INSTAGRAM", "YOUTUBE_SHORTS"], riskLevel: "LOW", expectedTypes: ["숫자 강조형"], evidence: { note: "Mock 조회 데이터", views: 0 }, sources: [] },
    ],
    PRODUCT_DATA: [
      { title: "배당 캘린더로 보는 이번 달 배당 지급 일정 정리법", coreQuestion: "배당 지급일을 한눈에 정리하는 방법", targetAudience: "여러 종목의 배당 일정을 관리하는 투자자", purpose: "기능 소개", category: "BRANDING", expectedChannels: ["THREADS", "INSTAGRAM"], riskLevel: "LOW", expectedTypes: ["일정형"], evidence: { note: "Mock 제품 데이터" }, sources: [] },
    ],
    EDUCATIONAL: [
      { title: "배당락일, 기준일, 지급일 한 번에 정리", coreQuestion: "세 날짜의 차이는?", targetAudience: "배당 투자 입문자", purpose: "교육", category: "INFORMATIONAL", expectedChannels: ["BLOG", "INSTAGRAM"], riskLevel: "LOW", expectedTypes: ["단계 설명형"], evidence: {}, sources: [] },
    ],
    COMMUNITY_QUESTION: [
      { title: "배당금 재투자, 자동으로 하면 뭐가 달라질까?", coreQuestion: "재투자 여부에 따른 차이를 어떻게 계산할까?", targetAudience: "배당 재투자를 고민하는 투자자", purpose: "참여 유도", category: "ENGAGEMENT", expectedChannels: ["THREADS"], riskLevel: "LOW", expectedTypes: ["참여형"], evidence: { note: "Mock 커뮤니티 질문" }, sources: [] },
    ],
  };
  return base[sourceType] ?? base.TREND;
}

// ---------- master ----------

function mockMaster(ctx: Record<string, unknown>): ContentMasterBody {
  const topic = (ctx.topic as { title: string; coreQuestion?: string; sourceType?: string; evidence?: Record<string, unknown>; sources?: ContentMasterBody["sources"] }) ?? { title: "제목 없음" };
  const facts = (ctx.facts as Fact[] | undefined) ?? [];
  const asOfDate = String(ctx.asOfDate ?? new Date().toISOString().slice(0, 10));
  const cautions = (ctx.cautions as string[] | undefined) ?? [];
  const cta = ctaOf(ctx);

  if (isDividendCalc(facts)) {
    const lines = scenarioLines(facts);
    return {
      title: topic.title,
      summary: `${disp(fact(facts, "monthlyTarget"))}의 월 배당을 받으려면 연간 ${disp(fact(facts, "annualTarget"))}이 필요하고, 배당수익률에 따라 필요한 투자금이 크게 달라집니다.`,
      asOfDate,
      facts,
      sources: topic.sources ?? [{ name: "서비스 내부 계산기(단순 계산)", url: "", retrievedAt: asOfDate, note: "requiredPrincipal = annualTarget ÷ dividendYield" }],
      cautions,
      cta: { label: cta.label, url: cta.url, strength: (cta.strength as "low" | "medium" | "high") ?? "low" },
      keyMessages: [
        `월 ${disp(fact(facts, "monthlyTarget"))} = 연 ${disp(fact(facts, "annualTarget"))}`,
        ...lines.map((l) => `배당수익률 ${l.yieldText}이면 약 ${l.principalText} 필요`),
        "세금과 환율은 반영하지 않은 단순 계산",
      ],
    };
  }

  // 계산 외 소재: 숫자를 만들지 않는다. 필요한 수치는 needsSource로 표시.
  const evidenceText = topic.evidence ? JSON.stringify(topic.evidence) : "";
  const hasEvidence = Boolean(topic.sources && topic.sources.length > 0);
  return {
    title: topic.title,
    summary: topic.coreQuestion ? `${topic.coreQuestion} 이 질문을 조건과 기준일을 붙여 차분하게 정리합니다.` : `${topic.title}을(를) 쉽게 정리합니다.`,
    asOfDate,
    facts: hasEvidence
      ? []
      : [
          {
            key: "keyFigure",
            label: "핵심 수치(출처 필요)",
            value: "미확인",
            unit: "",
            display: "",
            formula: "",
            assumptions: [],
            sourceRef: "",
            needsSource: true,
          },
        ],
    sources: topic.sources ?? [],
    cautions: cautions.length ? cautions : ["특정 종목 추천이 아님", "조건에 따라 결과가 달라질 수 있음"],
    cta: { label: cta.label, url: cta.url, strength: (cta.strength as "low" | "medium" | "high") ?? "low" },
    keyMessages: [
      topic.coreQuestion || topic.title,
      "숫자보다 기준과 조건을 먼저 확인하기",
      evidenceText ? "근거 데이터는 소재에 첨부된 메모를 참고" : "구체적인 수치는 출처 확인 후 추가",
    ],
  };
}

// ---------- threads ----------

function mockThreads(ctx: Record<string, unknown>): ThreadsBody[] {
  const m = masterOf(ctx);
  const facts = m.facts;
  const opts = (ctx.options as { includeLink?: boolean; ctaStrength?: "none" | "low" | "medium" | "high"; lessAdLike?: boolean }) ?? {};
  const includeLink = opts.includeLink ?? true;
  const ctaStrength = opts.ctaStrength ?? "low";
  const lessAdLike = opts.lessAdLike ?? true;
  const cta = ctaOf(ctx);
  const link = includeLink && cta.url ? `\n${cta.url}` : "";
  const ctaLine = ctaStrength === "none" ? "" : ctaStrength === "high" ? `\n${cta.label} 👉` : ctaStrength === "medium" ? `\n${cta.label}` : lessAdLike ? "\n(직접 계산해 보고 싶다면 아래 링크)" : `\n${cta.label}`;
  const dateLine = `\n(기준일 ${m.asOfDate}, 세금·환율 미반영)`;

  if (isDividendCalc(facts)) {
    const lines = scenarioLines(facts);
    const monthly = disp(fact(facts, "monthlyTarget"));
    const annual = disp(fact(facts, "annualTarget"));
    return [
      {
        variant: "INFO",
        text: `월 ${monthly} 배당을 받으려면 얼마가 필요할까요?\n\n연간으로는 ${annual}입니다.\n${lines.map((l) => `· 배당수익률 ${l.yieldText} → 약 ${l.principalText}`).join("\n")}${dateLine}${ctaLine}${link}`,
        includeLink, ctaStrength, lessAdLike,
        factRefs: ["monthlyTarget", "annualTarget", ...lines.flatMap((l) => [l.yieldKey, l.principalKey])],
      },
      {
        variant: "OBSERVATION",
        text: `계산기를 만들다 보니 느낀 점.\n\n월 ${monthly}이라는 목표는 같아도 배당수익률이 ${lines[0]?.yieldText ?? ""}인지 ${lines[lines.length - 1]?.yieldText ?? ""}인지에 따라 필요한 돈이 ${lines[0]?.principalText ?? ""}에서 ${lines[lines.length - 1]?.principalText ?? ""}까지 달라집니다.\n\n숫자 하나보다 조건을 먼저 정하는 게 순서더라고요.${dateLine}${ctaLine}${link}`,
        includeLink, ctaStrength, lessAdLike,
        factRefs: ["monthlyTarget", lines[0]?.yieldKey, lines[0]?.principalKey, lines[lines.length - 1]?.yieldKey, lines[lines.length - 1]?.principalKey].filter(Boolean) as string[],
      },
      {
        variant: "ENGAGEMENT",
        text: `여러분의 월 목표 배당금은 얼마인가요?\n\n월 ${monthly}이면 배당수익률 ${lines[1]?.yieldText ?? lines[0]?.yieldText ?? ""} 기준 약 ${lines[1]?.principalText ?? lines[0]?.principalText ?? ""}이 필요하다는 단순 계산이 나옵니다.\n\n목표 금액과 지금 생각하는 배당수익률을 댓글로 남겨 주세요.${dateLine}${ctaLine}${link}`,
        includeLink, ctaStrength, lessAdLike,
        factRefs: ["monthlyTarget", lines[1]?.yieldKey ?? lines[0]?.yieldKey, lines[1]?.principalKey ?? lines[0]?.principalKey].filter(Boolean) as string[],
      },
    ];
  }

  const msg = m.keyMessages[0] ?? m.title;
  return [
    { variant: "INFO", text: `${m.title}\n\n${m.summary}\n\n핵심: ${msg}${dateLine}${ctaLine}${link}`, includeLink, ctaStrength, lessAdLike, factRefs: [] },
    { variant: "OBSERVATION", text: `운영하면서 자주 받는 질문이 있습니다.\n\n"${msg}"\n\n답은 숫자 하나가 아니라 기준과 조건에 있더라고요. ${m.cautions[0] ? `(${m.cautions[0]})` : ""}${dateLine}${ctaLine}${link}`, includeLink, ctaStrength, lessAdLike, factRefs: [] },
    { variant: "ENGAGEMENT", text: `${msg}\n\n여러분은 어떤 기준으로 판단하시나요? 댓글로 알려 주세요.${dateLine}${ctaLine}${link}`, includeLink, ctaStrength, lessAdLike, factRefs: [] },
  ];
}

// ---------- instagram ----------

function mockInstagram(ctx: Record<string, unknown>): InstagramBody {
  const m = masterOf(ctx);
  const facts = m.facts;
  const template = (ctx.template as InstagramBody["template"]) ?? "number-focus";
  const brand = brandOf(ctx);
  const cta = ctaOf(ctx);
  const cards: InstagramBody["cards"] = [];

  if (isDividendCalc(facts)) {
    const lines = scenarioLines(facts);
    const monthly = disp(fact(facts, "monthlyTarget"));
    cards.push({ id: "c1", type: "cover", title: `월 ${monthly} 배당`, subtitle: "얼마가 필요할까?", body: "", label: "", value: "", items: [], rows: [], factRefs: ["monthlyTarget"] });
    cards.push({ id: "c2", type: "calculation", title: "연간 목표 배당금", subtitle: "", body: "월 목표 × 12개월", label: "연간 목표", value: disp(fact(facts, "annualTarget")), items: [], rows: [], factRefs: ["annualTarget"] });
    lines.forEach((l, i) => {
      cards.push({ id: `c${3 + i}`, type: "calculation", title: `배당수익률 ${l.yieldText}이라면`, subtitle: "", body: "연간 목표 ÷ 배당수익률", label: "필요 투자금", value: `약 ${l.principalText}`, items: [], rows: [], factRefs: [l.yieldKey, l.principalKey] });
    });
    cards.push({ id: `c${3 + lines.length}`, type: "comparison", title: "한눈에 비교", subtitle: "", body: "", label: "", value: "", items: [], rows: lines.map((l) => ({ label: `배당수익률 ${l.yieldText}`, value: `약 ${l.principalText}` })), factRefs: lines.flatMap((l) => [l.yieldKey, l.principalKey]) });
    cards.push({ id: `c${4 + lines.length}`, type: "checklist", title: "이 숫자를 볼 때 주의할 점", subtitle: "", body: "", label: "", value: "", items: m.cautions.slice(0, 4), rows: [], factRefs: [] });
    cards.push({ id: `c${5 + lines.length}`, type: "cta", title: cta.label, subtitle: `기준일 ${m.asOfDate}`, body: "내 목표 금액으로 직접 계산해 보세요", label: "", value: "", items: [], rows: [], factRefs: [] });
  } else {
    cards.push({ id: "c1", type: "cover", title: m.title, subtitle: m.keyMessages[0] ?? "", body: "", label: "", value: "", items: [], rows: [], factRefs: [] });
    cards.push({ id: "c2", type: "text", title: "핵심 정리", subtitle: "", body: m.summary, label: "", value: "", items: [], rows: [], factRefs: [] });
    cards.push({ id: "c3", type: "checklist", title: "확인할 것", subtitle: "", body: "", label: "", value: "", items: m.keyMessages.slice(0, 4), rows: [], factRefs: [] });
    cards.push({ id: "c4", type: "checklist", title: "주의할 점", subtitle: "", body: "", label: "", value: "", items: m.cautions.slice(0, 4), rows: [], factRefs: [] });
    cards.push({ id: "c5", type: "cta", title: cta.label, subtitle: `기준일 ${m.asOfDate}`, body: "", label: "", value: "", items: [], rows: [], factRefs: [] });
  }

  return {
    template,
    size: { width: 1080, height: 1350 },
    cards,
    caption: `${m.title}\n\n${m.summary}\n\n기준일 ${m.asOfDate} · ${m.cautions.join(", ")}\n${brand.financeDisclaimer ?? ""}`.trim(),
    hashtags: ["#배당", "#배당투자", "#배당금계산", "#월배당", "#재테크"],
    altTexts: cards.map((c) => `${c.title}${c.value ? ` - ${c.label} ${c.value}` : ""}${c.subtitle ? ` (${c.subtitle})` : ""}`.trim()),
  };
}

// ---------- blog ----------

function mockBlog(ctx: Record<string, unknown>): BlogBody {
  const m = masterOf(ctx);
  const facts = m.facts;
  const brand = brandOf(ctx);
  const product = (ctx.product as { name?: string; url?: string }) ?? {};
  const cta = ctaOf(ctx);
  const calc = isDividendCalc(facts);
  const lines = scenarioLines(facts);
  const monthly = disp(fact(facts, "monthlyTarget"));
  const annual = disp(fact(facts, "annualTarget"));

  const titleCandidates = calc
    ? [
        `월 ${monthly} 배당 받으려면 얼마 필요할까? 배당수익률별 계산`,
        `월 ${monthly} 배당금 목표, 필요한 투자금 한눈에 정리 (${m.asOfDate} 기준)`,
        `배당수익률 ${lines[0]?.yieldText ?? ""}~${lines[lines.length - 1]?.yieldText ?? ""}일 때 월 ${monthly} 배당에 필요한 돈`,
        `월 배당 ${monthly} 만들기: 연 ${annual}을 배당수익률로 나누면`,
        `월 ${monthly} 배당 계산법과 주의할 점 3가지`,
      ]
    : [m.title, `${m.title} 쉽게 정리`, `${m.title}: 기준과 조건 먼저 보기`, `${m.title} 체크리스트`, `${m.title} FAQ`];

  const sections: BlogBody["sections"] = calc
    ? [
        { heading: "월 목표를 연간으로 바꾸기", markdown: `월 ${monthly}의 배당을 받고 싶다면 1년에 ${annual}이 필요합니다. 계산은 단순히 월 목표 × 12입니다.` },
        {
          heading: "배당수익률별 필요 투자금",
          markdown: `| 배당수익률 | 필요 투자금 |\n| --- | --- |\n${lines.map((l) => `| ${l.yieldText} | 약 ${l.principalText} |`).join("\n")}\n\n계산식: 필요 투자금 = 연간 목표 배당금 ÷ 배당수익률. 세금과 환율은 반영하지 않았습니다.`,
        },
        { heading: "이 계산에서 빠진 것", markdown: m.cautions.map((c) => `- ${c}`).join("\n") },
        { heading: "직접 계산해 보기", markdown: `${product.name ?? "계산기"}에서 내 목표 금액과 배당수익률을 넣어 직접 확인할 수 있습니다.` },
      ]
    : [
        { heading: "핵심 정리", markdown: m.summary },
        { heading: "확인할 기준", markdown: m.keyMessages.map((k) => `- ${k}`).join("\n") },
        { heading: "주의할 점", markdown: m.cautions.map((c) => `- ${c}`).join("\n") },
      ];

  return {
    searchIntent: calc ? `월 ${monthly} 배당 필요 투자금` : m.title,
    titleCandidates,
    title: titleCandidates[0],
    metaDescription: calc ? `월 ${monthly} 배당을 받기 위해 필요한 투자금을 배당수익률별로 계산했습니다. 기준일 ${m.asOfDate}, 세금·환율 미반영.` : `${m.title}을(를) 조건과 기준일과 함께 정리했습니다.`,
    toc: sections.map((s) => s.heading).concat(["자주 묻는 질문"]),
    sections,
    faq: calc
      ? [
          { q: "배당수익률은 어디서 확인하나요?", a: "종목이나 ETF의 공시 자료, 운용사 페이지에서 확인할 수 있으며 시점에 따라 달라집니다." },
          { q: "세금을 반영하면 어떻게 되나요?", a: "이 계산은 세전 기준입니다. 배당소득세를 반영하면 같은 목표에 더 많은 투자금이 필요합니다." },
        ]
      : [{ q: "이 내용은 투자 권유인가요?", a: "아니요. 정보 정리 목적이며 특정 종목의 매수·매도를 권유하지 않습니다." }],
    sources: m.sources,
    asOfDate: m.asOfDate,
    disclaimer: brand.financeDisclaimer ?? "",
    internalLinks: product.url ? [{ label: `${product.name ?? "서비스"} 바로가기`, url: product.url }] : [],
    cta: { label: cta.label, url: cta.url, strength: (cta.strength as "low" | "medium" | "high") ?? "low" },
    thumbnailText: calc ? `월 ${monthly} 배당\n필요 투자금은?` : m.title,
    factRefs: facts.map((f) => f.key),
  };
}

// ---------- shorts ----------

function mockShorts(ctx: Record<string, unknown>): ShortsBody {
  const m = masterOf(ctx);
  const facts = m.facts;
  const durationSec = (Number(ctx.durationSec) as 30 | 45 | 60) || 45;
  const cta = ctaOf(ctx);
  const calc = isDividendCalc(facts);
  const lines = scenarioLines(facts);
  const monthly = disp(fact(facts, "monthlyTarget"));
  const annual = disp(fact(facts, "annualTarget"));

  const raw: { narration: string; onScreenText: string; description: string; factRefs: string[] }[] = calc
    ? [
        { narration: `월 ${monthly} 배당, 얼마가 있어야 받을 수 있을까요?`, onScreenText: `월 ${monthly} 배당\n얼마 필요할까?`, description: "질문형 훅, 큰 숫자 강조", factRefs: ["monthlyTarget"] },
        { narration: `먼저 1년치로 바꾸면 ${annual}입니다.`, onScreenText: `연간 ${annual}`, description: "월×12 계산 애니메이션", factRefs: ["annualTarget"] },
        ...lines.map((l) => ({ narration: `배당수익률이 ${l.yieldText}이면 약 ${l.principalText}이 필요합니다.`, onScreenText: `${l.yieldText} → 약 ${l.principalText}`, description: "시나리오 카드", factRefs: [l.yieldKey, l.principalKey] })),
        { narration: "세금과 환율은 빠진 단순 계산이니, 조건을 꼭 확인하세요.", onScreenText: "세금·환율 미반영\n조건 확인 필수", description: "주의 문구", factRefs: [] },
        { narration: `내 목표 금액으로 직접 계산해 보세요. ${cta.label}.`, onScreenText: cta.label, description: "CTA 엔딩", factRefs: [] },
      ]
    : [
        { narration: m.keyMessages[0] ?? m.title, onScreenText: m.title, description: "훅", factRefs: [] },
        { narration: m.summary, onScreenText: m.keyMessages[1] ?? "", description: "핵심 정리", factRefs: [] },
        { narration: m.cautions[0] ?? "조건을 먼저 확인하세요.", onScreenText: m.cautions[0] ?? "", description: "주의", factRefs: [] },
        { narration: `${cta.label}.`, onScreenText: cta.label, description: "CTA", factRefs: [] },
      ];

  const per = durationSec / raw.length;
  const scenes = raw.map((s, i) => ({
    index: i,
    startSec: Math.round(i * per * 10) / 10,
    endSec: Math.round((i + 1) * per * 10) / 10,
    narration: s.narration,
    onScreenText: s.onScreenText,
    description: s.description,
    subtitle: s.narration,
    factRefs: s.factRefs,
  }));

  return {
    durationSec,
    hook: raw[0].narration,
    scenes,
    cta: cta.label,
    titleCandidates: calc ? [`월 ${monthly} 배당 받으려면 얼마 필요할까?`, `배당수익률별 필요 투자금 (${m.asOfDate} 기준)`, `월 ${monthly} 배당 계산 30초 정리`] : [m.title, `${m.title} 30초 정리`],
    description: `${m.summary}\n\n기준일 ${m.asOfDate}. ${m.cautions.join(", ")}.\n${cta.url}`.trim(),
    hashtags: ["#배당", "#배당투자", "#월배당", "#shorts"],
    thumbnailText: calc ? `월 ${monthly}\n배당 받으려면?` : m.title,
    voice: "default",
    factRefs: facts.map((f) => f.key),
  };
}

// ---------- learning ----------

function mockLearning(ctx: Record<string, unknown>) {
  const before = String(ctx.before ?? "");
  const after = String(ctx.after ?? "");
  const patterns: { pattern: string; description: string }[] = [];
  if (after.length < before.length * 0.85) patterns.push({ pattern: "shorten", description: "사용자가 문장을 더 짧게 줄이는 경향" });
  if ((before.match(/!/g)?.length ?? 0) > (after.match(/!/g)?.length ?? 0)) patterns.push({ pattern: "fewer_exclamations", description: "느낌표 사용을 줄임" });
  if ((before.match(/👉|🔥|✨/g)?.length ?? 0) > (after.match(/👉|🔥|✨/g)?.length ?? 0)) patterns.push({ pattern: "fewer_emojis", description: "이모지 사용을 줄임" });
  if (patterns.length === 0) patterns.push({ pattern: "wording", description: "표현을 다듬음 (구체 패턴 미확인)" });
  return { patterns };
}
