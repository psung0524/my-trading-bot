import { DbJobQueue } from "./db";
import type { JobQueueProvider } from "./types";

export type { JobQueueProvider, JobRecord } from "./types";

const g = globalThis as unknown as { jobQueue?: JobQueueProvider };
export function getJobQueue(): JobQueueProvider {
  // QUEUE_PROVIDER=bullmq 등은 추후 확장 지점
  g.jobQueue ??= new DbJobQueue();
  return g.jobQueue;
}
