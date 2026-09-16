import { describe, expect, it } from "vitest";
import { isPrivateAddress, assertPublicUrl } from "@/server/providers/analyzer/html";
import { MockProductAnalyzer } from "@/server/providers/analyzer/mock";
import { productAnalysisSchema } from "@/lib/schemas/product";

describe("analyzer SSRF 방지", () => {
  it("사설 대역 판별", () => {
    expect(isPrivateAddress("127.0.0.1")).toBe(true);
    expect(isPrivateAddress("10.1.2.3")).toBe(true);
    expect(isPrivateAddress("172.16.0.1")).toBe(true);
    expect(isPrivateAddress("172.32.0.1")).toBe(false);
    expect(isPrivateAddress("192.168.1.1")).toBe(true);
    expect(isPrivateAddress("169.254.169.254")).toBe(true);
    expect(isPrivateAddress("8.8.8.8")).toBe(false);
    expect(isPrivateAddress("::1")).toBe(true);
    expect(isPrivateAddress("fd00::1")).toBe(true);
  });
  it("localhost / 내부 IP URL 거부", async () => {
    await expect(assertPublicUrl("http://localhost:3000")).rejects.toThrow();
    await expect(assertPublicUrl("http://127.0.0.1/admin")).rejects.toThrow();
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow();
    await expect(assertPublicUrl("ftp://example.com")).rejects.toThrow();
  });
});

describe("MockProductAnalyzer", () => {
  it("스키마에 맞는 결과", async () => {
    const r = await new MockProductAnalyzer().analyze("https://dividend.example.com");
    expect(productAnalysisSchema.safeParse(r).success).toBe(true);
    expect(r.title).toContain("dividend.example.com");
    expect(r.features.length).toBeGreaterThan(0);
  });
});
