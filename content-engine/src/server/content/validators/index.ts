import type { ChannelType } from "@prisma/client";
import type { ContentMasterBody, ValidationIssue, ValidationResult } from "@/lib/schemas/content";
import { checkConsistency, checkMasterIntegrity } from "./consistency";
import { checkFinanceSafety } from "./finance-safety";
import { extractChannelTexts } from "../channel-text";

export function summarize(issues: ValidationIssue[]): ValidationResult {
  const blocked = issues.some((i) => i.severity === "BLOCK");
  return { ok: issues.length === 0, blocked, issues, checkedAt: new Date().toISOString() };
}

export function validateMaster(master: ContentMasterBody, forbiddenPhrases: string[]): ValidationResult {
  const issues = [
    ...checkMasterIntegrity(master),
    ...checkFinanceSafety(`${master.title}\n${master.summary}\n${master.keyMessages.join("\n")}`, { facts: master.facts, asOfDate: master.asOfDate, cautions: master.cautions, forbiddenPhrases, requireAsOfDate: false }, "master"),
  ];
  return summarize(issues);
}

/** 채널 콘텐츠 검증: consistency + finance safety + 금지 표현 */
export function validateChannelBody(channel: ChannelType, body: unknown, master: ContentMasterBody, forbiddenPhrases: string[]): ValidationResult {
  const texts = extractChannelTexts(channel, body);
  const issues: ValidationIssue[] = [];
  for (const t of texts) {
    issues.push(...checkConsistency(t.text, master.facts, { asOfDate: master.asOfDate, location: t.location }));
    issues.push(...checkFinanceSafety(t.text, { facts: master.facts, asOfDate: master.asOfDate, cautions: master.cautions, forbiddenPhrases, requireAsOfDate: t.requireAsOfDate }, t.location));
  }
  // 동일 코드+위치 중복 제거
  const uniq = new Map<string, ValidationIssue>();
  for (const i of issues) uniq.set(`${i.code}|${i.location}|${i.excerpt}`, i);
  return summarize([...uniq.values()]);
}
