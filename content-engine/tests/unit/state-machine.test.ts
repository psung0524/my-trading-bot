import { describe, expect, it } from "vitest";
import { canTransition, assertTransition, PUBLISHABLE } from "@/server/publish/state-machine";

describe("content state machine", () => {
  it("허용 전이", () => {
    expect(canTransition("NEEDS_REVIEW", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "SCHEDULED")).toBe(true);
    expect(canTransition("SCHEDULED", "PUBLISHING")).toBe(true);
    expect(canTransition("PUBLISHING", "PUBLISHED")).toBe(true);
    expect(canTransition("FAILED", "APPROVED")).toBe(true);
  });
  it("금지 전이", () => {
    expect(canTransition("DRAFT", "PUBLISHED")).toBe(false);
    expect(canTransition("NEEDS_REVIEW", "PUBLISHING")).toBe(false);
    expect(canTransition("PUBLISHED", "NEEDS_REVIEW")).toBe(false);
    expect(canTransition("ARCHIVED", "DRAFT")).toBe(false);
    expect(() => assertTransition("DRAFT", "PUBLISHED")).toThrow();
  });
  it("게시 가능 상태는 APPROVED/SCHEDULED뿐", () => {
    expect(PUBLISHABLE).toEqual(["APPROVED", "SCHEDULED"]);
  });
});
