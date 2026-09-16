/**
 * RateLimiter 인터페이스. 기본 구현은 프로세스 메모리(개발/단일 인스턴스).
 * 운영 다중 인스턴스에서는 Redis 구현으로 교체한다.
 */
export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; remaining: number; resetAt: number }>;
}

type Bucket = { count: number; resetAt: number };

export class MemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, Bucket>();

  async check(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      if (this.buckets.size > 10000) this.sweep(now);
      return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
    }
    b.count += 1;
    return { ok: b.count <= limit, remaining: Math.max(0, limit - b.count), resetAt: b.resetAt };
  }

  private sweep(now: number) {
    for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k);
  }
}

const globalForRl = globalThis as unknown as { rateLimiter?: RateLimiter };
export const rateLimiter: RateLimiter = globalForRl.rateLimiter ?? new MemoryRateLimiter();
globalForRl.rateLimiter = rateLimiter;

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
