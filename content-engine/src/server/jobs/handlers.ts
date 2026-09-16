import type { ChannelType } from "@prisma/client";
import { registerJob } from "./registry";
import { generateAllChannels, type GenerateOptions } from "@/server/content/channels/generate";
import { prisma } from "@/server/db/prisma";

type GeneratePayload = { workspaceId: string; masterId: string; channels: ChannelType[]; options?: GenerateOptions; userId?: string };

registerJob("content.generate", async (payload, ctx) => {
  const p = payload as GeneratePayload;
  ctx.log(`채널 생성 시작: ${p.channels.join(", ")}`);
  await prisma.contentMaster.updateMany({ where: { id: p.masterId, workspaceId: p.workspaceId, status: "DRAFT" }, data: { status: "GENERATING" } });
  try {
    const result = await generateAllChannels(p.workspaceId, p.masterId, p.channels, p.options ?? {}, p.userId);
    await prisma.contentMaster.updateMany({ where: { id: p.masterId, workspaceId: p.workspaceId, status: "GENERATING" }, data: { status: "NEEDS_REVIEW" } });
    ctx.log(`생성 완료: ${JSON.stringify(result)}`);
    return result;
  } catch (e) {
    await prisma.contentMaster.updateMany({ where: { id: p.masterId, workspaceId: p.workspaceId, status: "GENERATING" }, data: { status: "DRAFT" } });
    throw e;
  }
});
