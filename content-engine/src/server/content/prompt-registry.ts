import { prisma } from "@/server/db/prisma";
import { getPrompt } from "./prompts";

/** 사용된 프롬프트 버전을 DB에 기록(멱등). 워크스페이스별 오버라이드가 있으면 그것을 우선한다. */
export async function resolvePrompt(key: string, workspaceId?: string) {
  const def = getPrompt(key);
  if (workspaceId) {
    const override = await prisma.promptTemplate.findFirst({
      where: { workspaceId, key },
      include: { versions: { where: { isActive: true }, orderBy: { version: "desc" }, take: 1 } },
    });
    const v = override?.versions[0];
    if (v) return { key, version: v.version, system: v.system, user: v.user, schemaName: def.schemaName, source: "workspace" as const };
  }
  await prisma.promptTemplate.upsert({
    where: { workspaceId_key: { workspaceId: null as unknown as string, key } },
    create: { key, workspaceId: null, description: "내장 프롬프트", versions: { create: { version: def.version, system: def.system, user: def.user, schemaName: def.schemaName } } },
    update: {},
  }).catch(async () => {
    // Prisma는 null 복합 unique upsert를 지원하지 않는 경우가 있어 수동 처리
    const existing = await prisma.promptTemplate.findFirst({ where: { workspaceId: null, key } });
    if (!existing) {
      await prisma.promptTemplate.create({ data: { key, workspaceId: null, description: "내장 프롬프트", versions: { create: { version: def.version, system: def.system, user: def.user, schemaName: def.schemaName } } } });
    } else {
      const has = await prisma.promptVersion.findFirst({ where: { templateId: existing.id, version: def.version } });
      if (!has) await prisma.promptVersion.create({ data: { templateId: existing.id, version: def.version, system: def.system, user: def.user, schemaName: def.schemaName } });
    }
  });
  return { ...def, source: "builtin" as const };
}
