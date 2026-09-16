import type { Metadata } from "next";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { listInbox } from "@/server/queries/inbox";
import { can } from "@/server/tenancy/permissions";
import { PageHeader } from "@/components/app/page-header";
import { InboxList } from "./inbox-list";

export const metadata: Metadata = { title: "승인함" };

export default async function InboxPage(props: PageProps<"/w/[slug]/inbox">) {
  const { slug } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const { items, accounts } = await listInbox(ctx.workspace.id);
  return (
    <div>
      <PageHeader title="승인함" description="검토가 필요한 콘텐츠입니다. 승인은 ADMIN 이상만 할 수 있으며, 게시 전 서버가 승인 상태와 버전을 다시 확인합니다." />
      <InboxList slug={slug} items={items} accounts={accounts} canApprove={can(ctx.role, "approveContent")} canPublish={can(ctx.role, "publishContent")} />
    </div>
  );
}
