import type { ProductAnalyzer } from "./types";
import { MockProductAnalyzer } from "./mock";
import { HtmlProductAnalyzer } from "./html";

export type { ProductAnalyzer };

/**
 * PRODUCT_ANALYZER=mock 이면 항상 Mock.
 * 기본(auto)은 HTML 분석을 시도하고 실패하면 Mock 결과에 error를 붙여 돌려준다.
 */
export function getProductAnalyzer(): ProductAnalyzer {
  const mode = process.env.PRODUCT_ANALYZER ?? "auto";
  if (mode === "mock") return new MockProductAnalyzer();
  const html = new HtmlProductAnalyzer();
  const mock = new MockProductAnalyzer();
  return {
    async analyze(url) {
      try {
        return await html.analyze(url);
      } catch (e) {
        const fallback = await mock.analyze(url);
        return { ...fallback, error: `실시간 분석 실패(${(e as Error).message}). 예시 데이터로 대체했습니다. 직접 수정하세요.` };
      }
    },
  };
}
