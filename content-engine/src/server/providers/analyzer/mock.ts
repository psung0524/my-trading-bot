import type { ProductAnalysis } from "@/lib/schemas/product";
import type { ProductAnalyzer } from "./types";

/** 네트워크 없이 동작하는 분석기. 배당 서비스 예시 데이터를 돌려준다. */
export class MockProductAnalyzer implements ProductAnalyzer {
  async analyze(url: string): Promise<ProductAnalysis> {
    const host = safeHost(url);
    return {
      title: `${host} - 배당 계산기`,
      description: "목표 배당금에 필요한 투자금, 배당수익률별 시나리오, 월 배당 캘린더를 계산해 주는 서비스",
      headings: ["목표 배당금 계산기", "배당수익률 비교", "월별 배당 캘린더"],
      features: ["목표 배당금 계산기", "배당수익률별 필요 투자금 비교", "월 배당 캘린더", "포트폴리오 배당 합계"],
      keywords: ["배당", "배당금 계산", "배당수익률", "월배당", "배당 캘린더"],
      audience: "배당 투자를 시작했거나 관심 있는 개인 투자자",
      pages: [
        { path: "/calculator", title: "목표 배당금 계산기" },
        { path: "/calendar", title: "배당 캘린더" },
      ],
      method: "mock",
      fetchedAt: new Date().toISOString(),
    };
  }
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "example.com";
  }
}
