import { describe, expect, it } from "vitest";
import { analyzeMix, similarity } from "@/server/content/content-mix";

describe("content mix", () => {
  it("홍보 편중 시 정보형/참여형 우선", () => {
    const r = analyzeMix(["PROMOTION", "PROMOTION", "PROMOTION", "INFORMATIONAL"]);
    expect(r.warning).toContain("직접 홍보");
    expect(r.recommendedOrder.slice(0, 2)).toEqual(["INFORMATIONAL", "ENGAGEMENT"]);
  });
  it("비어 있으면 목표 비율 순서", () => {
    const r = analyzeMix([]);
    expect(r.warning).toBeNull();
    expect(r.recommendedOrder[0]).toBe("INFORMATIONAL");
  });
  it("similarity", () => {
    expect(similarity("월 50만 원 배당 필요 투자금", "월 50만 원 배당 필요 투자금")).toBe(1);
    expect(similarity("배당락일 정리", "환율 계산기")).toBe(0);
  });
});
