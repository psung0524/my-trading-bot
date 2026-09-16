import type { ChannelType } from "@prisma/client";
import { registerJob } from "./registry";
import { collectChannelBatch, generateAllChannels, submitChannelBatch, type GenerateMode, type GenerateOptions } from "@/server/content/channels/generate";
import { prisma } from "@/server/db/prisma";
import { getJobQueue } from "@/server/providers/queue";
import "./render-handlers";
import "./publish-handlers";

type GeneratePayload = { workspaceId: string; masterId: string; channels: ChannelType[]; options?: GenerateOptions; userId?: string; mode?: GenerateMode };
export type CollectPayload = GeneratePayload & { batchId: string; submittedAt: string; polls?: number };

/** 배치 회수 Job 사이 간격. 첫 회수는 2분 뒤, 이후 5분마다(최대 24시간) */
const COLLECT_FIRST_MS = 2 * 60_000;
const COLLECT_EVERY_MS = 5 * 60_000;
const COLLECT_MAX_POLLS = 300;

async function setMasterStatus(p: GeneratePayload, from: "DRAFT" | "GENERATING", to: "GENERATING" | "NEEDS_REVIEW" | "DRAFT") {
  await prisma.contentMaster.updateMany({ where: { id: p.masterId, workspaceId: p.workspaceId, status: from }, data: { status: to } });
}

registerJob("content.generate", async (payload, ctx) => {
  const p = payload as GeneratePayload;
  ctx.log(`채널 생성 시작: ${p.channels.join(", ")} (${p.mode ?? "immediate"})`);
  await setMasterStatus(p, "DRAFT", "GENERATING");
  try {
    if (p.mode === "batch") {
      const submitted = await submitChannelBatch(p.workspaceId, p.masterId, p.channels, p.options ?? {}, p.userId);
      if (submitted) {
        const collect: CollectPayload = { ...p, channels: submitted.channels, batchId: submitted.batchId, submittedAt: new Date().toISOString(), polls: 0 };
        const q = await getJobQueue().enqueue({ type: "content.generate.collect", workspaceId: p.workspaceId, payload: collect, runAt: new Date(Date.now() + COLLECT_FIRST_MS), idempotencyKey: `content.generate.collect:${submitted.batchId}`, maxAttempts: 5 });
        ctx.log(`배치 제출: ${submitted.batchId} → 회수 Job ${q.jobId}`);
        // Master는 GENERATING 상태로 두고 회수 Job이 끝낸다
        return { batchId: submitted.batchId, collectJobId: q.jobId, channels: submitted.channels, _errors: [] };
      }
      ctx.log("현재 Provider는 배치를 지원하지 않아 즉시 생성으로 대체합니다");
    }
    const result = await generateAllChannels(p.workspaceId, p.masterId, p.channels, p.options ?? {}, p.userId);
    await setMasterStatus(p, "GENERATING", "NEEDS_REVIEW");
    ctx.log(`생성 완료: ${JSON.stringify(result)}`);
    return result;
  } catch (e) {
    await setMasterStatus(p, "GENERATING", "DRAFT");
    throw e;
  }
});

registerJob("content.generate.collect", async (payload, ctx) => {
  const p = payload as CollectPayload;
  const res = await collectChannelBatch(p.workspaceId, p.masterId, p.batchId, p.channels, p.options ?? {}, p.userId);
  if (!res.ended) {
    const polls = (p.polls ?? 0) + 1;
    ctx.log(`아직 처리 중 (${polls}회 확인, ${JSON.stringify(res.counts ?? {})})`);
    if (polls >= COLLECT_MAX_POLLS) {
      await setMasterStatus(p, "GENERATING", "DRAFT");
      throw new Error("배치 결과가 24시간 안에 오지 않았습니다");
    }
    await getJobQueue().enqueue({ type: "content.generate.collect", workspaceId: p.workspaceId, payload: { ...p, polls }, runAt: new Date(Date.now() + COLLECT_EVERY_MS), idempotencyKey: `content.generate.collect:${p.batchId}:${polls}`, maxAttempts: 5 });
    return { ended: false, polls };
  }
  await setMasterStatus(p, "GENERATING", "NEEDS_REVIEW");
  ctx.log(`배치 회수 완료: ${JSON.stringify(res.results)} 오류: ${res._errors.join(" / ") || "없음"}`);
  return { ended: true, ...res.results, _errors: res._errors };
});
