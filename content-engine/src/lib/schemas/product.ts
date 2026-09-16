import { z } from "zod";

export const httpUrlSchema = z
  .string()
  .trim()
  .url("올바른 URL을 입력하세요")
  .refine((u) => /^https?:\/\//i.test(u), "http 또는 https URL만 허용됩니다");

export const productSchema = z.object({
  name: z.string().trim().min(1, "제품 이름을 입력하세요").max(80),
  url: httpUrlSchema,
  description: z.string().trim().max(2000).default(""),
});
export type ProductInput = z.output<typeof productSchema>;
export type ProductFormInput = z.input<typeof productSchema>;

export const productAnalysisSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  headings: z.array(z.string()).default([]),
  features: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  audience: z.string().default(""),
  pages: z.array(z.object({ path: z.string(), title: z.string().default("") })).default([]),
  /// mock | html
  method: z.string().default("manual"),
  fetchedAt: z.string().optional(),
  error: z.string().optional(),
});
export type ProductAnalysis = z.infer<typeof productAnalysisSchema>;

export const manualAnalysisSchema = z.object({
  features: z.string().default(""),
  keywords: z.string().default(""),
  audience: z.string().trim().max(500).default(""),
});

export const ctaSchema = z.object({
  label: z.string().trim().min(1, "CTA 문구를 입력하세요").max(60),
  url: z.string().trim().max(500).default(""),
  strength: z.enum(["low", "medium", "high"]).default("medium"),
});
export type Cta = z.infer<typeof ctaSchema>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "#RRGGBB 형식");

export const brandProfileSchema = z.object({
  brandName: z.string().trim().min(1, "브랜드명을 입력하세요").max(60),
  tagline: z.string().trim().max(200).default(""),
  operatorIdentity: z.string().trim().max(500).default(""),
  targetAudience: z.string().trim().max(500).default(""),
  contentGoal: z.string().trim().max(500).default(""),
  tone: z.string().trim().max(1000).default(""),
  preferredPhrases: z.array(z.string().trim().min(1).max(100)).max(50).default([]),
  forbiddenPhrases: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  ctas: z.array(ctaSchema).max(10).default([]),
  primaryColor: hex.default("#0F766E"),
  secondaryColor: hex.default("#F0FDFA"),
  accentColor: hex.default("#F59E0B"),
  fontFamily: z.string().trim().max(80).default("Pretendard"),
  financeDisclaimer: z.string().trim().max(1000).default(""),
});
export type BrandProfileInput = z.output<typeof brandProfileSchema>;
export type BrandProfileFormInput = z.input<typeof brandProfileSchema>;

export const brandRuleSchema = z.object({
  kind: z.enum(["FORBIDDEN_PHRASE", "PREFERRED_PHRASE", "TONE", "DISCLAIMER", "CTA", "CUSTOM"]),
  value: z.string().trim().min(1).max(500),
  note: z.string().trim().max(300).default(""),
});
