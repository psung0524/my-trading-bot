"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { connectMockAccountAction, connectWordPressAction, disconnectAccountAction } from "@/server/actions/channels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CHANNEL_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format/date";

type Account = { id: string; channel: string; provider: string; displayName: string; isMock: boolean; tokenExpiresAt: string | null; scopes: string[] };

const CHANNELS = [
  { key: "THREADS", desc: "공식 API로 텍스트 게시. 승인 후에만 게시되며 외부 게시물 ID와 URL을 저장합니다." },
  { key: "INSTAGRAM", desc: "MVP에서는 카드뉴스 PNG와 캡션을 내려받아 직접 게시합니다. API Provider가 연결되면 승인 후 게시 가능한 구조입니다." },
  { key: "BLOG", desc: "Markdown/HTML 내보내기. WordPress는 REST API로 초안 생성. 네이버 블로그는 복사·이미지 다운로드 방식." },
  { key: "YOUTUBE_SHORTS", desc: "MP4·자막·썸네일을 내려받아 업로드합니다. API 키가 없으면 Mock 업로드로 흐름을 검증합니다." },
];

export function ChannelsPanel({ slug, accounts, canManage, threadsConfigured, notice }: { slug: string; accounts: Account[]; canManage: boolean; threadsConfigured: boolean; notice: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [wp, setWp] = useState({ siteUrl: "", username: "", appPassword: "", status: "draft" });
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) => start(async () => { const r = await fn(); if (!r.ok) return void toast.error(r.error ?? "실패"); toast.success(msg); router.refresh(); });
  return (
    <div className="space-y-4">
      {notice && <p className="rounded-md border bg-accent/40 p-2 text-sm">{notice}</p>}
      {CHANNELS.map((c) => {
        const list = accounts.filter((a) => a.channel === c.key);
        return (
          <Card key={c.key}>
            <CardHeader>
              <CardTitle>{CHANNEL_LABELS[c.key]}</CardTitle>
              <CardDescription>{c.desc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {list.length === 0 ? <p className="text-sm text-muted-foreground">연결된 계정이 없습니다.</p> : (
                <ul className="space-y-1 text-sm">
                  {list.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-md border p-2" data-testid="channel-account">
                      <div>
                        <span className="font-medium">{a.displayName}</span> <Badge variant={a.isMock ? "secondary" : "default"}>{a.provider}</Badge>
                        {a.tokenExpiresAt && <span className="ml-2 text-xs text-muted-foreground">토큰 만료 {formatDate(a.tokenExpiresAt)}</span>}
                      </div>
                      {canManage && <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => disconnectAccountAction(slug, a.id), "연결을 해제했습니다")}>연결 해제</Button>}
                    </li>
                  ))}
                </ul>
              )}
              {canManage && (
                <div className="flex flex-wrap gap-2">
                  {!list.some((a) => a.isMock) && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => connectMockAccountAction(slug, c.key), "Mock 계정을 연결했습니다")}>Mock 계정 연결</Button>}
                  {c.key === "THREADS" && (threadsConfigured ? <Button asChild size="sm"><a href={`/api/channels/threads/connect?workspace=${slug}`}>Threads 계정 연결</a></Button> : <span className="self-center text-xs text-muted-foreground">실제 연결: THREADS_APP_ID / THREADS_APP_SECRET 환경변수를 설정하세요</span>)}
                </div>
              )}
              {c.key === "BLOG" && canManage && (
                <form className="grid gap-2 rounded-md border p-3 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); run(() => connectWordPressAction(slug, wp), "WordPress를 연결했습니다"); }}>
                  <div className="md:col-span-4 text-sm font-medium">WordPress 연결 (Application Password)</div>
                  <div><Label htmlFor="wp-url">사이트 URL</Label><Input id="wp-url" value={wp.siteUrl} onChange={(e) => setWp({ ...wp, siteUrl: e.target.value })} placeholder="https://blog.example.com" /></div>
                  <div><Label htmlFor="wp-user">사용자명</Label><Input id="wp-user" value={wp.username} onChange={(e) => setWp({ ...wp, username: e.target.value })} /></div>
                  <div><Label htmlFor="wp-pass">앱 비밀번호</Label><Input id="wp-pass" type="password" value={wp.appPassword} onChange={(e) => setWp({ ...wp, appPassword: e.target.value })} /></div>
                  <div className="flex items-end"><Button type="submit" size="sm" disabled={pending || !wp.siteUrl || !wp.username || !wp.appPassword}>연결</Button></div>
                </form>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
