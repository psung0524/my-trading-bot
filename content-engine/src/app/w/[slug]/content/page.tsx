import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { listMasters } from "@/server/queries/content";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { CHANNEL_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "콘텐츠" };

export default async function ContentListPage(props: PageProps<"/w/[slug]/content">) {
  const { slug } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  const masters = await listMasters(ctx.workspace.id);
  return (
    <div>
      <PageHeader
        title="콘텐츠"
        description="Content Master와 채널별 콘텐츠 상태입니다."
        actions={<Button asChild variant="outline"><Link href={`/w/${slug}/topics`}>소재에서 새로 만들기</Link></Button>}
      />
      {masters.length === 0 ? (
        <p className="text-sm text-muted-foreground">아직 콘텐츠가 없습니다. 소재를 선택해 Content Master를 만들어 보세요.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {masters.map((m) => (
            <li key={m.id} className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/w/${slug}/content/${m.id}`} className="font-medium hover:underline">{m.title}</Link>
                  <p className="text-xs text-muted-foreground">{m.product.name} · 기준일 {m.asOfDate.toISOString().slice(0, 10)}</p>
                </div>
                <StatusBadge status={m.status} />
              </div>
              {m.channels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  {m.channels.map((c) => (
                    <Link key={c.id} href={`/w/${slug}/content/${m.id}/${c.id}`} className="rounded border px-2 py-0.5 hover:bg-accent">
                      {CHANNEL_LABELS[c.channel]}{c.channel === "THREADS" ? ` · ${c.variant}` : ""} <span className="text-muted-foreground">({c.status})</span>
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
