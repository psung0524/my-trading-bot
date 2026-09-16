import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "@/server/security/rate-limit";

describe("MemoryRateLimiter", () => {
  it("한도 초과 시 차단", async () => {
    const rl = new MemoryRateLimiter();
    for (let i = 0; i < 3; i++) expect((await rl.check("k", 3, 1000)).ok).toBe(true);
    expect((await rl.check("k", 3, 1000)).ok).toBe(false);
    expect((await rl.check("other", 3, 1000)).ok).toBe(true);
  });
});
