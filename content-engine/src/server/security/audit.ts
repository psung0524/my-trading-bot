import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@prisma/client";

export async function audit(input: {
  workspaceId?: string | null;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: input.workspaceId ?? null,
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        meta: input.meta ?? {},
        ip: input.ip ?? null,
      },
    });
  } catch (e) {
    console.error("audit log 실패", e);
  }
}
