import { describe, expect, it } from "vitest";
import { collectEventSchema } from "@/lib/schemas/analytics";

const base = { workspaceId: "ws1", anonymousId: "anon1234", sessionId: "sess1234", eventName: "page_view" as const };

describe("collect event schema", () => {
  it("정상 이벤트", () => {
    expect(collectEventSchema.safeParse({ ...base, properties: { path: "/" }, utm: { source: "threads", content: "cc1" } }).success).toBe(true);
  });
  it("허용되지 않은 이벤트 이름 거부", () => {
    expect(collectEventSchema.safeParse({ ...base, eventName: "custom_thing" }).success).toBe(false);
  });
  it("개인정보 키 거부", () => {
    expect(collectEventSchema.safeParse({ ...base, properties: { email: "a@b.c" } }).success).toBe(false);
    expect(collectEventSchema.safeParse({ ...base, properties: { phoneNumber: "010" } }).success).toBe(false);
  });
  it("속성 개수/길이 제한", () => {
    const many = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`k${i}`, i]));
    expect(collectEventSchema.safeParse({ ...base, properties: many }).success).toBe(false);
    expect(collectEventSchema.safeParse({ ...base, properties: { x: "a".repeat(300) } }).success).toBe(false);
  });
});
