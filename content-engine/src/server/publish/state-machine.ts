import type { ContentStatus } from "@prisma/client";

/** 허용된 상태 전이 (요구사항 §10). 여기에 없는 전이는 서버에서 거부한다. */
const TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  IDEA: ["GENERATING", "ARCHIVED"],
  GENERATING: ["DRAFT", "NEEDS_REVIEW", "NEEDS_SOURCE", "FAILED", "ARCHIVED"],
  DRAFT: ["NEEDS_REVIEW", "NEEDS_SOURCE", "GENERATING", "ARCHIVED"],
  NEEDS_REVIEW: ["APPROVED", "REJECTED", "NEEDS_SOURCE", "DRAFT", "GENERATING", "ARCHIVED"],
  NEEDS_SOURCE: ["NEEDS_REVIEW", "DRAFT", "ARCHIVED"],
  APPROVED: ["SCHEDULED", "PUBLISHING", "NEEDS_REVIEW", "ARCHIVED"],
  SCHEDULED: ["PUBLISHING", "APPROVED", "NEEDS_REVIEW", "ARCHIVED"],
  PUBLISHING: ["PUBLISHED", "FAILED"],
  PUBLISHED: ["ARCHIVED"],
  FAILED: ["APPROVED", "SCHEDULED", "NEEDS_REVIEW", "ARCHIVED"],
  REJECTED: ["NEEDS_REVIEW", "DRAFT", "GENERATING", "ARCHIVED"],
  ARCHIVED: [],
};

export function canTransition(from: ContentStatus, to: ContentStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: ContentStatus, to: ContentStatus) {
  if (!canTransition(from, to)) throw new Error(`상태 전이 불가: ${from} → ${to}`);
}

export const PUBLISHABLE: ContentStatus[] = ["APPROVED", "SCHEDULED"];
