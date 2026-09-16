"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateChannelsAction } from "@/server/actions/content";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CHANNEL_LABELS } from "@/lib/labels";

const ALL = ["THREADS", "INSTAGRAM", "BLOG", "YOUTUBE_SHORTS"] as const;

export function GeneratePanel({ slug, masterId, disabled, existing }: { slug: string; masterId: string; disabled: boolean; existing: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [channels, setChannels] = useState<string[]>(ALL.filter((c) => !existing.includes(c) && c !== "YOUTUBE_SHORTS"));
  const [mode, setMode] = useState<"immediate" | "batch">("immediate");
  const [threadsCount, setThreadsCount] = useState("1");
  const [includeLink, setIncludeLink] = useState(false);
  const [ctaStrength, setCtaStrength] = useState("low");
  const [lessAdLike, setLessAdLike] = useState(true);
  const [template, setTemplate] = useState("magazine");
  const [durationSec, setDurationSec] = useState("45");
  const [blogLength, setBlogLength] = useState("1500");

  return (
    <Card>
      <CardHeader>
        <CardTitle>채널 콘텐츠 생성</CardTitle>
        <CardDescription>선택한 채널의 초안을 만듭니다. 생성 후 검토·승인 전에는 게시되지 않습니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {ALL.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <Checkbox id={`ch-${c}`} checked={channels.includes(c)} onCheckedChange={(v) => setChannels(v ? [...channels, c] : channels.filter((x) => x !== c))} />
              <Label htmlFor={`ch-${c}`}>{CHANNEL_LABELS[c]}{existing.includes(c) ? " (이미 있음, 추가 생성)" : ""}</Label>
            </div>
          ))}
        </div>
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <p className="font-medium">생성 방식</p>
          <select aria-label="생성 방식" className="h-8 w-full rounded-md border bg-background px-2" value={mode} onChange={(e) => setMode(e.target.value as "immediate" | "batch")}>
            <option value="immediate">즉시 생성 (몇 십 초)</option>
            <option value="batch">배치 생성 (약 50% 저렴 · 결과 수 분~최대 24시간)</option>
          </select>
          {mode === "batch" && <p className="text-xs text-muted-foreground">결과는 워커(npm run worker)가 자동으로 가져오거나, 이 화면의 &quot;지금 확인&quot; 버튼으로 가져옵니다. Mock 모드에서는 즉시 끝납니다.</p>}
          <p className="pt-1 font-medium">Threads 옵션</p>
          <div className="flex items-center gap-2">
            <Label htmlFor="opt-count">글 수</Label>
            <select id="opt-count" className="h-8 rounded-md border bg-background px-2" value={threadsCount} onChange={(e) => setThreadsCount(e.target.value)}>
              <option value="1">1편 (가장 강한 훅 하나)</option><option value="2">2편</option><option value="3">3편 (포맷 다르게)</option>
            </select>
          </div>
          <div className="flex items-center gap-2"><Checkbox id="opt-link" checked={includeLink} onCheckedChange={(v) => setIncludeLink(Boolean(v))} /><Label htmlFor="opt-link">링크 포함</Label></div>
          <div className="flex items-center gap-2"><Checkbox id="opt-ad" checked={lessAdLike} onCheckedChange={(v) => setLessAdLike(Boolean(v))} /><Label htmlFor="opt-ad">광고 느낌 줄이기</Label></div>
          <div className="flex items-center gap-2">
            <Label htmlFor="opt-cta">CTA 강도</Label>
            <select id="opt-cta" className="h-8 rounded-md border bg-background px-2" value={ctaStrength} onChange={(e) => setCtaStrength(e.target.value)}>
              <option value="none">없음</option><option value="low">약하게</option><option value="medium">보통</option><option value="high">강하게</option>
            </select>
          </div>
          <p className="pt-1 font-medium">Instagram 템플릿</p>
          <select aria-label="카드뉴스 템플릿" className="h-8 rounded-md border bg-background px-2" value={template} onChange={(e) => setTemplate(e.target.value)}>
            <option value="magazine">잡지형(하이라이트 제목·패널)</option><option value="number-focus">숫자 강조형</option><option value="comparison">비교표형</option><option value="checklist">체크리스트형</option><option value="steps">단계 설명형</option><option value="schedule">일정형</option>
          </select>
          <p className="pt-1 font-medium">블로그 길이</p>
          <select aria-label="블로그 길이" className="h-8 rounded-md border bg-background px-2" value={blogLength} onChange={(e) => setBlogLength(e.target.value)}>
            <option value="1500">약 1,500자 (기본, 출력 토큰 절약)</option><option value="2500">약 2,500자</option><option value="4000">약 4,000자</option>
          </select>
          <p className="pt-1 font-medium">Shorts 길이</p>
          <select aria-label="Shorts 길이" className="h-8 rounded-md border bg-background px-2" value={durationSec} onChange={(e) => setDurationSec(e.target.value)}>
            <option value="30">30초</option><option value="45">45초</option><option value="60">60초</option>
          </select>
        </div>
        <Button
          className="w-full"
          disabled={disabled || pending || channels.length === 0}
          onClick={() =>
            start(async () => {
              const res = await generateChannelsAction(slug, masterId, {
                channels,
                options: { threads: { includeLink, ctaStrength, lessAdLike, count: Number(threadsCount) }, instagram: { template }, shorts: { durationSec: Number(durationSec) }, blog: { targetLength: Number(blogLength) } },
                mode,
              });
              if (!res.ok) return void toast.error(res.error);
              if (res.data.batch) toast.success("배치를 제출했습니다. 결과가 오면 채널 콘텐츠에 나타납니다");
              else toast.success("채널 콘텐츠를 생성했습니다");
              for (const w of res.data.warnings) toast.error(`일부 채널 실패 - ${w}`, { duration: 15000 });
              router.refresh();
            })
          }
        >
          {pending ? "생성 중..." : disabled ? "출처 보완 후 생성 가능" : "선택한 채널 생성"}
        </Button>
      </CardContent>
    </Card>
  );
}
