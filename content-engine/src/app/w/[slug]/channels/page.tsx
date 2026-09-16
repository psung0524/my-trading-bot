import type { Metadata } from "next";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { prisma } from "@/server/db/prisma";
import { can } from "@/server/tenancy/permissions";
import { PageHeader } from "@/components/app/page-header";
import { ChannelsPanel } from "./channels-panel";

export const metadata: Metadata = { title: "채널 연결" };

export default async function ChannelsPage(props: PageProps<"/w/[slug]/channels">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireWorkspacePage(slug);
  const accounts = await prisma.channelAccount.findMany({ where: { workspaceId: ctx.workspace.id, deletedAt: null }, orderBy: { createdAt: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader title="채널 연결" description="실제 API 키가 없어도 Mock 계정으로 게시 흐름을 검증할 수 있습니다. 실제 계정 토큰은 암호화되어 저장됩니다." />
      <ChannelsPanel
        slug={slug}
        canManage={can(ctx.role, "manageChannels")}
        threadsConfigured={Boolean(process.env.THREADS_APP_ID && process.env.THREADS_APP_SECRET)}
        notice={typeof sp.error === "string" ? `오류: ${sp.error}` : typeof sp.connected === "string" ? `${sp.connected} 연결 완료` : null}
        accounts={accounts.map((a) => ({ id: a.id, channel: a.channel, provider: a.provider, displayName: a.displayName, isMock: a.isMock, tokenExpiresAt: a.tokenExpiresAt?.toISOString() ?? null, scopes: a.scopes }))}
      />
    </div>
  );
}
