/**
 * 프롬프트 버전 관리. 키별로 version을 올리고, 사용 시 PromptTemplate/PromptVersion에 기록한다.
 * 규칙: 새 숫자를 만들지 말 것, facts.display를 그대로 인용할 것, 기준일과 조건을 표기할 것.
 */
export type PromptDef = { key: string; version: number; system: string; user: string; schemaName: string };

const COMMON_RULES = `당신은 금융 정보 서비스의 브랜드 콘텐츠 작가입니다. 반드시 지킬 규칙:
1. 컨텍스트의 facts 배열에 있는 숫자만 사용합니다. 각 숫자는 facts[].display 표기를 글자 그대로 인용합니다. 새 숫자·비율·날짜를 만들지 않습니다.
2. 숫자를 언급할 때는 기준일(asOfDate)과 조건(cautions)을 함께 표시합니다.
3. 특정 종목의 매수·매도 지시, 수익 보장, 과장, 불안 조성 표현을 쓰지 않습니다. brand.forbiddenPhrases는 절대 사용하지 않습니다.
4. brand.tone과 preferredPhrases를 따릅니다. 운영자는 전문가가 아니라 정보를 쉽게 정리하는 도구 운영자입니다.
5. 모르는 사실은 만들지 말고 비워 둡니다.
6. 모든 결과는 한국어로 작성합니다.`;

export const PROMPTS: Record<string, PromptDef> = {
  "topic.discover": {
    key: "topic.discover", version: 1, schemaName: "TopicCandidates",
    system: COMMON_RULES,
    user: "제품 정보와 sourceType에 맞는 콘텐츠 소재 후보 3~5개를 제안하세요. 각 후보는 title, coreQuestion, targetAudience, purpose, category(INFORMATIONAL|DATA|ENGAGEMENT|BRANDING|PROMOTION), expectedChannels, riskLevel, expectedTypes, evidence, sources를 가집니다. 근거 없는 수치는 넣지 마세요.",
  },
  "master.generate": {
    key: "master.generate", version: 1, schemaName: "ContentMaster",
    system: COMMON_RULES,
    user: "소재(topic)로부터 모든 채널이 공유할 Content Master를 만드세요. 컨텍스트에 facts가 주어지면 그대로 유지하고 추가 숫자를 만들지 마세요. facts가 없고 수치가 필요하면 needsSource=true인 fact를 추가하세요. title, summary, asOfDate, facts, sources, cautions, cta, keyMessages(3~5개)를 작성하세요.",
  },
  "threads.generate": {
    key: "threads.generate", version: 1, schemaName: "ThreadsPosts",
    system: COMMON_RULES,
    user: "Content Master로 Threads 게시글 3종(INFO 정보형, OBSERVATION 운영자 관찰형, ENGAGEMENT 참여형)을 만드세요. 각 글은 500자 이내, 줄바꿈으로 읽기 쉽게. options.includeLink, ctaStrength, lessAdLike를 반영하세요. 사용한 fact key를 factRefs에 넣으세요.",
  },
  "instagram.generate": {
    key: "instagram.generate", version: 1, schemaName: "InstagramCards",
    system: COMMON_RULES,
    user: "Content Master로 Instagram 카드뉴스(cards 5~8장)를 만드세요. template 유형을 반영하고 cover → 핵심 카드 → 주의 → cta 순서로 구성하세요. 각 카드 title 20자 이내, body 60자 이내. caption, hashtags, altTexts도 작성하세요.",
  },
  "blog.generate": {
    key: "blog.generate", version: 1, schemaName: "BlogPost",
    system: COMMON_RULES,
    user: "Content Master로 검색 의도에 맞는 블로그 글을 만드세요. titleCandidates 5개, title, metaDescription(120자 내), toc, sections(markdown, 표와 계산 예시 포함), faq 2~4개, sources, asOfDate, disclaimer, internalLinks, cta, thumbnailText를 작성하세요.",
  },
  "shorts.generate": {
    key: "shorts.generate", version: 1, schemaName: "ShortsScript",
    system: COMMON_RULES,
    user: "Content Master로 YouTube Shorts 대본과 스토리보드를 만드세요. durationSec(30|45|60)에 맞춰 scenes를 나누고 첫 3초 hook을 강하게(과장 없이) 만드세요. 각 scene은 startSec, endSec, narration(한 문장), onScreenText(2줄 이내), description, subtitle을 가집니다. titleCandidates, description, hashtags, thumbnailText, cta도 작성하세요.",
  },
  "learning.analyze": {
    key: "learning.analyze", version: 1, schemaName: "LearningPatterns",
    system: "당신은 편집 차이를 분석하는 도구입니다.",
    user: "before(AI 원본)와 after(사용자 수정본)를 비교해 반복 가능한 편집 패턴을 patterns[{pattern, description}]로 추출하세요. 개인정보나 일회성 내용은 제외합니다.",
  },
};

export function getPrompt(key: string): PromptDef {
  const p = PROMPTS[key];
  if (!p) throw new Error(`알 수 없는 프롬프트 키: ${key}`);
  return p;
}
