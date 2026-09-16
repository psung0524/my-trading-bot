import type { ChannelType } from "@prisma/client";
import type { PublisherProvider, PublishInput, PublishResult } from "./types";

const g = globalThis as unknown as { mockPublished?: Map<string, PublishResult> };

/** Mock Publisher: 외부 API 없이 게시 흐름을 검증. 같은 멱등키는 같은 결과를 돌려준다 */
export class MockPublisher implements PublisherProvider {
  readonly name = "mock";
  constructor(public readonly channel: ChannelType) {}
  isConfigured() {
    return true;
  }
  async publish(input: PublishInput): Promise<PublishResult> {
    g.mockPublished ??= new Map();
    const prev = g.mockPublished.get(input.idempotencyKey);
    if (prev) {
      input.log("Mock: 동일 멱등키 → 기존 결과 반환");
      return prev;
    }
    if (process.env.MOCK_PUBLISH_FAIL === "1") throw new Error("Mock 게시 실패(테스트용)");
    const id = `mock_${this.channel.toLowerCase()}_${Date.now().toString(36)}`;
    const host = { THREADS: "threads.net/@mock", INSTAGRAM: "instagram.com/p", BLOG: "blog.example.com/posts", YOUTUBE_SHORTS: "youtube.com/shorts" }[this.channel];
    const result = { externalId: id, externalUrl: `https://${host}/${id}`, raw: { mock: true, assets: input.assets.map((a) => a.key) } };
    g.mockPublished.set(input.idempotencyKey, result);
    input.log(`Mock ${this.channel} 게시 완료: ${result.externalUrl}`);
    return result;
  }
}
