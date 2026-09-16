import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, hmacSign, hmacVerify } from "@/server/security/crypto";

describe("crypto", () => {
  it("암호화/복호화 왕복", () => {
    const enc = encryptSecret("access-token-123");
    expect(enc).not.toContain("access-token");
    expect(decryptSecret(enc)).toBe("access-token-123");
  });
  it("같은 평문도 매번 다른 암호문", () => {
    expect(encryptSecret("a")).not.toBe(encryptSecret("a"));
  });
  it("HMAC 검증", () => {
    const sig = hmacSign("secret", "body");
    expect(hmacVerify("secret", "body", sig)).toBe(true);
    expect(hmacVerify("secret", "body", "sha256=" + sig)).toBe(true);
    expect(hmacVerify("secret", "other", sig)).toBe(false);
    expect(hmacVerify("secret", "body", "00")).toBe(false);
  });
});
