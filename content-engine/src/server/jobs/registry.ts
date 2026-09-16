import type { Prisma } from "@prisma/client";

export type JobContext = {
  jobId: string;
  attempt: number;
  log: (msg: string) => void;
};

export type JobHandler = (payload: Prisma.JsonValue, ctx: JobContext) => Promise<Prisma.InputJsonValue | void>;

const handlers = new Map<string, JobHandler>();

export function registerJob(type: string, handler: JobHandler) {
  handlers.set(type, handler);
}
export function getJobHandler(type: string) {
  return handlers.get(type);
}
export function listJobTypes() {
  return [...handlers.keys()];
}
