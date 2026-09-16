import { describe, expect, it } from "vitest";
import { withUtm } from "@/server/analytics/tracking";

describe("withUtm", () => {
  it("UTM 파라미터 추가 및 기존 쿼리 보존", () => {
    const u = new URL(withUtm("https://example.com/calc?x=1", { utmSource: "threads", utmMedium: "social", utmCampaign: "c1", utmContent: "cc1" }));
    expect(u.searchParams.get("x")).toBe("1");
    expect(u.searchParams.get("utm_source")).toBe("threads");
    expect(u.searchParams.get("utm_medium")).toBe("social");
    expect(u.searchParams.get("utm_campaign")).toBe("c1");
    expect(u.searchParams.get("utm_content")).toBe("cc1");
  });
  it("잘못된 URL은 그대로", () => {
    expect(withUtm("not a url", { utmSource: "a", utmMedium: "b", utmCampaign: "c", utmContent: "d" })).toBe("not a url");
  });
});
