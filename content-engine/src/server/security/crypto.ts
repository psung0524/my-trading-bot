import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from "node:crypto";

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY ?? "";
  let key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    // base64가 아니거나 길이가 다르면 문자열 자체를 키 재료로 사용(개발 편의). 운영에서는 32바이트 base64 권장.
    key = createHmac("sha256", "content-engine").update(raw).digest();
  }
  return key;
}

/** AES-256-GCM. 결과: base64(iv).base64(tag).base64(ciphertext) */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("잘못된 암호문 형식");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function hmacSign(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function hmacVerify(secret: string, body: string, signature: string): boolean {
  const expected = Buffer.from(hmacSign(secret, body), "hex");
  const given = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

export function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString("base64url");
}
