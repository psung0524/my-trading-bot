import { GA4Forwarder } from "./ga4";
import type { AnalyticsForwarder } from "./types";

export type { AnalyticsForwarder } from "./types";

export function getAnalyticsForwarders(): AnalyticsForwarder[] {
  const out: AnalyticsForwarder[] = [];
  if (process.env.GA4_MEASUREMENT_ID && process.env.GA4_API_SECRET) out.push(new GA4Forwarder(process.env.GA4_MEASUREMENT_ID, process.env.GA4_API_SECRET));
  return out;
}
