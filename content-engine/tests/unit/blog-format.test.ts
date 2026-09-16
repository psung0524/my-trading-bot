import { describe, expect, it } from "vitest";
import { formatForMobile, splitSentences } from "@/lib/blog-format";

describe("blog-format", () => {
  it("문장을 나눈다", () => {
    expect(splitSentences("첫 문장입니다. 둘째 문장이죠? 셋째!")).toEqual(["첫 문장입니다.", "둘째 문장이죠?", "셋째!"]);
  });
  it("긴 문단을 2~3문장 문단으로 나눈다", () => {
    const md = "배당주 투자를 시작하고 처음 배당금이 입금됐을 때, 저는 통장에 찍힌 숫자를 보고 다 내 돈이라고 생각했습니다. 그런데 몇 년 이어가면서 알게 된 건 그 숫자가 끝이 아니라는 점이었습니다. 세금이 먼저 빠져나가는 건 다들 알고 있습니다. 정작 덜 알려진 부분은 건강보험료입니다.";
    const out = formatForMobile(md);
    const paras = out.split("\n\n");
    expect(paras.length).toBeGreaterThanOrEqual(2);
    for (const p of paras) expect(splitSentences(p).length).toBeLessThanOrEqual(3);
    expect(out.replace(/\s+/g, "")).toBe(md.replace(/\s+/g, ""));
  });
  it("제목·목록·표는 유지한다", () => {
    const md = "## 소제목\n\n- 항목 하나. 둘. 셋.\n\n| a | b |\n| - | - |\n| 1. | 2. |\n\n> 인용. 문장. 셋.";
    expect(formatForMobile(md)).toBe(md);
  });
  it("소수점은 문장 경계로 보지 않는다", () => {
    expect(splitSentences("수익률은 4.5%입니다. 다음.")).toEqual(["수익률은 4.5%입니다.", "다음."]);
  });
});
