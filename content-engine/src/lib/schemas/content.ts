import { z } from "zod";

// ---------- Content Master ----------

export const sourceRefSchema = z.object({
  name: z.string().min(1),
  url: z.string().default(""),
  retrievedAt: z.string().default(""),
  note: z.string().default(""),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const factSchema = z.object({
  key: z.string().min(1).regex(/^[a-z][a-zA-Z0-9_]*$/, "key는 영문 camelCase"),
  label: z.string().min(1),
  value: z.union([z.number(), z.string()]),
  unit: z.string().default(""),
  /// 표시용 문자열(예: "600만 원"). 채널 콘텐츠는 이 표기를 그대로 사용한다.
  display: z.string().default(""),
  formula: z.string().default(""),
  assumptions: z.array(z.string()).default([]),
  /// sources 배열의 인덱스 또는 name
  sourceRef: z.string().default(""),
  /// 출처가 없는 수치는 true. 이 경우 콘텐츠는 NEEDS_SOURCE
  needsSource: z.boolean().default(false),
});
export type Fact = z.infer<typeof factSchema>;

export const ctaRefSchema = z.object({
  label: z.string().min(1),
  url: z.string().default(""),
  strength: z.enum(["low", "medium", "high"]).default("medium"),
});

export const contentMasterBodySchema = z.object({
  title: z.string().min(1),
  summary: z.string().default(""),
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  facts: z.array(factSchema).default([]),
  sources: z.array(sourceRefSchema).default([]),
  cautions: z.array(z.string()).default([]),
  cta: ctaRefSchema.nullable().default(null),
  /// 핵심 메시지(채널 변환의 뼈대)
  keyMessages: z.array(z.string()).default([]),
});
export type ContentMasterBody = z.infer<typeof contentMasterBodySchema>;

// ---------- Validation ----------

export const validationIssueSchema = z.object({
  code: z.string(),
  severity: z.enum(["BLOCK", "WARN", "INFO"]),
  message: z.string(),
  location: z.string().default(""),
  /// 이슈를 유발한 텍스트 조각
  excerpt: z.string().default(""),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const validationResultSchema = z.object({
  ok: z.boolean(),
  blocked: z.boolean(),
  issues: z.array(validationIssueSchema),
  checkedAt: z.string(),
});
export type ValidationResult = z.infer<typeof validationResultSchema>;

// ---------- Channel bodies ----------

export const threadsVariantSchema = z.enum(["INFO", "OBSERVATION", "ENGAGEMENT"]);
export type ThreadsVariant = z.infer<typeof threadsVariantSchema>;

export const threadsBodySchema = z.object({
  variant: threadsVariantSchema,
  text: z.string().min(1).max(500),
  includeLink: z.boolean().default(true),
  ctaStrength: z.enum(["none", "low", "medium", "high"]).default("low"),
  lessAdLike: z.boolean().default(true),
  /// 사용한 fact key
  factRefs: z.array(z.string()).default([]),
});
export type ThreadsBody = z.infer<typeof threadsBodySchema>;

export const cardTemplateSchema = z.enum(["number-focus", "comparison", "checklist", "steps", "schedule", "magazine"]);
export type CardTemplate = z.infer<typeof cardTemplateSchema>;

export const cardSchema = z.object({
  id: z.string().default(""),
  type: z.enum(["cover", "calculation", "comparison", "checklist", "step", "schedule", "text", "cta"]),
  title: z.string().default(""),
  subtitle: z.string().default(""),
  body: z.string().default(""),
  label: z.string().default(""),
  value: z.string().default(""),
  items: z.array(z.string()).default([]),
  /// 비교표/일정: [{label, value}]
  rows: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  factRefs: z.array(z.string()).default([]),
  /// 잡지형(magazine) 템플릿용: 표지 태그, 패널 라벨(┌ 라벨), 하단 굵은 소제목, 각주
  tag: z.string().default(""),
  sectionLabel: z.string().default(""),
  heading: z.string().default(""),
  footnote: z.string().default(""),
});
export type Card = z.infer<typeof cardSchema>;

export const instagramBodySchema = z.object({
  template: cardTemplateSchema.default("number-focus"),
  size: z.object({ width: z.number().default(1080), height: z.number().default(1350) }).default({ width: 1080, height: 1350 }),
  cards: z.array(cardSchema).min(3).max(10),
  caption: z.string().default(""),
  hashtags: z.array(z.string()).default([]),
  altTexts: z.array(z.string()).default([]),
  colors: z.object({ primary: z.string(), secondary: z.string(), accent: z.string() }).optional(),
});
export type InstagramBody = z.infer<typeof instagramBodySchema>;

export const blogBodySchema = z.object({
  searchIntent: z.string().default(""),
  titleCandidates: z.array(z.string()).min(1).max(7),
  title: z.string().min(1),
  metaDescription: z.string().max(200).default(""),
  toc: z.array(z.string()).default([]),
  sections: z.array(z.object({ heading: z.string(), markdown: z.string() })).min(1),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  sources: z.array(sourceRefSchema).default([]),
  asOfDate: z.string().default(""),
  disclaimer: z.string().default(""),
  internalLinks: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  cta: ctaRefSchema.nullable().default(null),
  thumbnailText: z.string().default(""),
  factRefs: z.array(z.string()).default([]),
});
export type BlogBody = z.infer<typeof blogBodySchema>;

export const shortsSceneSchema = z.object({
  index: z.number().int().min(0),
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  narration: z.string().default(""),
  onScreenText: z.string().default(""),
  description: z.string().default(""),
  subtitle: z.string().default(""),
  factRefs: z.array(z.string()).default([]),
});
export type ShortsScene = z.infer<typeof shortsSceneSchema>;

export const shortsBodySchema = z.object({
  durationSec: z.union([z.literal(30), z.literal(45), z.literal(60)]).default(45),
  hook: z.string().default(""),
  scenes: z.array(shortsSceneSchema).min(2).max(12),
  cta: z.string().default(""),
  titleCandidates: z.array(z.string()).default([]),
  description: z.string().default(""),
  hashtags: z.array(z.string()).default([]),
  thumbnailText: z.string().default(""),
  voice: z.string().default("default"),
  factRefs: z.array(z.string()).default([]),
});
export type ShortsBody = z.infer<typeof shortsBodySchema>;

export const channelBodySchemas = {
  THREADS: threadsBodySchema,
  INSTAGRAM: instagramBodySchema,
  BLOG: blogBodySchema,
  YOUTUBE_SHORTS: shortsBodySchema,
} as const;

// ---------- Topics ----------

export const contentCategorySchema = z.enum(["INFORMATIONAL", "DATA", "ENGAGEMENT", "BRANDING", "PROMOTION"]);
export const sourceTypeSchema = z.enum([
  "PRODUCT_DATA", "MANUAL_INPUT", "USER_QUESTION", "TREND", "FREQUENTLY_VIEWED", "CALCULATION", "FEATURE_UPDATE", "EDUCATIONAL", "COMMUNITY_QUESTION",
]);

export const topicCandidateSchema = z.object({
  title: z.string().min(1).max(120),
  coreQuestion: z.string().default(""),
  targetAudience: z.string().default(""),
  purpose: z.string().default(""),
  category: contentCategorySchema.default("INFORMATIONAL"),
  expectedChannels: z.array(z.enum(["THREADS", "INSTAGRAM", "BLOG", "YOUTUBE_SHORTS"])).default(["THREADS", "INSTAGRAM", "BLOG", "YOUTUBE_SHORTS"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).default("LOW"),
  expectedTypes: z.array(z.string()).default([]),
  evidence: z.record(z.string(), z.unknown()).default({}),
  sources: z.array(sourceRefSchema).default([]),
});
export type TopicCandidate = z.infer<typeof topicCandidateSchema>;

export const calculationParamsSchema = z.object({
  monthlyTarget: z.number().int().min(10_000).max(1_000_000_000),
  yields: z.array(z.number().min(0.001).max(0.5)).min(1).max(6).default([0.03, 0.04, 0.05]),
});
export type CalculationParams = z.infer<typeof calculationParamsSchema>;

export const createTopicSchema = z.discriminatedUnion("sourceType", [
  z.object({
    sourceType: z.literal("MANUAL_INPUT"),
    title: z.string().trim().min(1).max(120),
    coreQuestion: z.string().trim().max(300).default(""),
    category: contentCategorySchema.default("INFORMATIONAL"),
    notes: z.string().trim().max(2000).default(""),
  }),
  z.object({
    sourceType: z.literal("USER_QUESTION"),
    question: z.string().trim().min(5).max(300),
    context: z.string().trim().max(1000).default(""),
  }),
  z.object({
    sourceType: z.literal("CALCULATION"),
    monthlyTarget: z.coerce.number().int().min(10_000).max(1_000_000_000),
    yields: z.string().trim().default("3,4,5"),
  }),
  z.object({
    sourceType: z.literal("FEATURE_UPDATE"),
    featureName: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(5).max(1000),
    url: z.string().trim().max(500).default(""),
  }),
]);
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
