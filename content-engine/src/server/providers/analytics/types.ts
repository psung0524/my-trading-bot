import type { CollectEvent } from "@/lib/schemas/analytics";

/** 외부 분석 도구로 이벤트를 전달하는 Provider (GA4 등). 자체 DB 저장은 항상 수행된다 */
export interface AnalyticsForwarder {
  readonly name: string;
  forward(event: CollectEvent & { channelContentId: string | null }): Promise<void>;
}
