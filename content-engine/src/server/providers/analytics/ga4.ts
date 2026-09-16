import type { CollectEvent } from "@/lib/schemas/analytics";
import type { AnalyticsForwarder } from "./types";

/** GA4 Measurement Protocol. GA4_MEASUREMENT_ID + GA4_API_SECRET 가 있을 때만 활성 */
export class GA4Forwarder implements AnalyticsForwarder {
  readonly name = "ga4";
  constructor(private measurementId: string, private apiSecret: string) {}
  async forward(e: CollectEvent) {
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(this.measurementId)}&api_secret=${encodeURIComponent(this.apiSecret)}`;
    const body = { client_id: e.anonymousId, user_id: e.userId ?? undefined, events: [{ name: e.eventName, params: { ...e.properties, session_id: e.sessionId, content_id: e.channelContentId ?? undefined, campaign_id: e.campaignId ?? undefined } }] };
    await fetch(url, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } }).catch(() => undefined);
  }
}
