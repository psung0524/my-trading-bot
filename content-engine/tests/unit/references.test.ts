import { describe, expect, it } from "vitest";
import { extractArticleText, normalizeReferenceUrl } from "@/server/content/references";

describe("references", () => {
  it("네이버 글 주소 → PostView", () => {
    expect(normalizeReferenceUrl("https://blog.naver.com/spark0524/224410228842")).toBe("https://blog.naver.com/PostView.naver?blogId=spark0524&logNo=224410228842");
    expect(normalizeReferenceUrl("https://example.tistory.com/12")).toBe("https://example.tistory.com/12");
  });
  it("본문 추출: article 우선, 스크립트 제거", () => {
    const html = `<html><head><title>월배당 정리 : 네이버 블로그</title><script>var x=1</script></head><body><nav>메뉴 메뉴</nav><article><h2>제목</h2><p>첫 문단입니다.</p><p>둘째 문단 &amp; 내용</p></article></body></html>`;
    const r = extractArticleText(html);
    expect(r.title).toBe("월배당 정리");
    expect(r.text).toContain("첫 문단입니다.");
    expect(r.text).toContain("둘째 문단 & 내용");
    expect(r.text).not.toContain("var x");
  });
});
