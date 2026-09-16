import { z } from "zod";

export const EVENT_NAMES = [
  "page_view", "content_click", "signup_started", "signup_completed", "calculator_used", "stock_added", "portfolio_created", "return_visit", "subscription_started",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** 개인정보로 볼 수 있는 속성 키는 거부한다 */
const PII_KEYS = /(email|phone|tel|name|address|birth|ssn|card|password|token)/i;

export const collectEventSchema = z.object({
  workspaceId: z.string().min(1).max(64),
  productId: z.string().max(64).optional().nullable(),
  campaignId: z.string().max(64).optional().nullable(),
  channelContentId: z.string().max(64).optional().nullable(),
  anonymousId: z.string().min(4).max(64),
  userId: z.string().max(128).optional().nullable(),
  sessionId: z.string().min(4).max(64),
  eventName: z.enum(EVENT_NAMES),
  properties: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean()])).default({}).refine((p) => Object.keys(p).length <= 20 && !Object.keys(p).some((k) => PII_KEYS.test(k)), "속성이 너무 많거나 개인정보 키가 포함되어 있습니다"),
  timestamp: z.string().datetime().optional(),
  landingPage: z.string().max(1000).optional().nullable(),
  referrer: z.string().max(1000).optional().nullable(),
  utm: z.object({ source: z.string().max(100).optional(), medium: z.string().max(100).optional(), campaign: z.string().max(200).optional(), content: z.string().max(200).optional() }).optional(),
});
export type CollectEvent = z.infer<typeof collectEventSchema>;

export const collectBatchSchema = z.object({ events: z.array(collectEventSchema).min(1).max(20) });
