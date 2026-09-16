import type { Metadata } from "next";
import Link from "next/link";
import { requireWorkspacePage } from "@/server/tenancy/context";
import { prisma } from "@/server/db/prisma";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/app/status-badge";
import { CHANNEL_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "콘텐츠 캘린더" };

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getUTCDay() + 6) % 7; // 월요일 시작
  x.setUTCDate(x.getUTCDate() - day);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export default async function CalendarPage(props: PageProps<"/w/[slug]/calendar">) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const ctx = await requireWorkspacePage(slug);
  const base = typeof sp.week === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.week) ? new Date(`${sp.week}T00:00:00Z`) : new Date();
  const start = startOfWeek(base);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const items = await prisma.channelContent.findMany({
    where: { workspaceId: ctx.workspace.id, deletedAt: null, OR: [{ scheduledAt: { gte: start, lt: end } }, { publishedAt: { gte: start, lt: end } }, { status: { in: ["NEEDS_REVIEW", "APPROVED"] }, updatedAt: { gte: start, lt: end } }] },
    include: { master: { select: { title: true } } },
    orderBy: { updatedAt: "asc" },
  });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
  const key = (d: Date) => d.toISOString().slice(0, 10);
  const prev = new Date(start); prev.setUTCDate(prev.getUTCDate() - 7);
  const next = new Date(start); next.setUTCDate(next.getUTCDate() + 7);
  const unscheduled = items.filter((i) => !i.scheduledAt && !i.publishedAt);

  return (
    <div>
      <PageHeader
        title="주간 콘텐츠 캘린더"
        description={`${key(start)} ~ ${key(days[6])} · 예약·게시된 콘텐츠와 이번 주 검토 대기 항목`}
        actions={<><Button asChild variant="outline" size="sm"><Link href={`/w/${slug}/calendar?week=${key(prev)}`}>이전 주</Link></Button><Button asChild variant="outline" size="sm"><Link href={`/w/${slug}/calendar`}>이번 주</Link></Button><Button asChild variant="outline" size="sm"><Link href={`/w/${slug}/calendar?week=${key(next)}`}>다음 주</Link></Button></>}
      />
      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d) => {
          const k = key(d);
          const dayItems = items.filter((i) => key(i.scheduledAt ?? i.publishedAt ?? new Date(0)) === k);
          return (
            <div key={k} className="min-h-32 rounded-md border p-2">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{["월", "화", "수", "목", "금", "토", "일"][(d.getUTCDay() + 6) % 7]} {k.slice(5)}</p>
              <ul className="space-y-1">
                {dayItems.map((i) => (
                  <li key={i.id} className="rounded border bg-card p-1.5 text-xs">
                    <Link href={`/w/${slug}/content/${i.masterId}/${i.id}`} className="block truncate font-medium hover:underline">{i.master.title}</Link>
                    <span className="text-muted-foreground">{CHANNEL_LABELS[i.channel]}</span> <StatusBadge status={i.status} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {unscheduled.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">일정 없음 (검토·승인 대기)</h2>
          <ul className="flex flex-wrap gap-2 text-xs">
            {unscheduled.map((i) => (
              <li key={i.id} className="rounded border p-1.5"><Link href={`/w/${slug}/content/${i.masterId}/${i.id}`} className="hover:underline">{i.master.title}</Link> · {CHANNEL_LABELS[i.channel]} <StatusBadge status={i.status} /></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
