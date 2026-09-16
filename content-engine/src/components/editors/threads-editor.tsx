"use client";

import { useState } from "react";
import type { ThreadsBody } from "@/lib/schemas/content";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ThreadsPreview } from "@/components/channels/threads-preview";

export function ThreadsEditor({ body, brandName, onChange }: { body: ThreadsBody; brandName: string; onChange: (b: ThreadsBody) => void }) {
  const [b, setB] = useState(body);
  const update = (patch: Partial<ThreadsBody>) => {
    const next = { ...b, ...patch };
    setB(next);
    onChange(next);
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        <div>
          <Label htmlFor="threads-text">본문 ({b.text.length}/500)</Label>
          <Textarea id="threads-text" rows={12} value={b.text} onChange={(e) => update({ text: e.target.value })} className="mt-1 font-mono text-sm" />
          {b.text.length > 500 && <p className="text-xs text-destructive">500자를 넘었습니다</p>}
        </div>
        <div>
          <Label htmlFor="threads-reply">답글 문구 (게시 후 직접 남기는 답글 · 블로그 링크는 여기에)</Label>
          <Textarea id="threads-reply" rows={3} value={b.replyText} onChange={(e) => update({ replyText: e.target.value })} className="mt-1 font-mono text-sm" placeholder="정리한 표는 여기서 볼 수 있습니다 → (링크)" />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2"><Checkbox id="t-link" checked={b.includeLink} onCheckedChange={(v) => update({ includeLink: Boolean(v) })} /><Label htmlFor="t-link">링크 포함</Label></div>
          <div className="flex items-center gap-2"><Checkbox id="t-ad" checked={b.lessAdLike} onCheckedChange={(v) => update({ lessAdLike: Boolean(v) })} /><Label htmlFor="t-ad">광고 느낌 줄이기</Label></div>
          <div className="flex items-center gap-2">
            <Label htmlFor="t-cta">CTA 강도</Label>
            <select id="t-cta" className="h-8 rounded-md border bg-background px-2" value={b.ctaStrength} onChange={(e) => update({ ctaStrength: e.target.value as ThreadsBody["ctaStrength"] })}>
              <option value="none">없음</option><option value="low">약하게</option><option value="medium">보통</option><option value="high">강하게</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">옵션을 바꾼 뒤 &quot;이 옵션으로 재생성&quot;을 누르면 AI가 다시 씁니다. 직접 고친 본문은 &quot;저장&quot;으로 새 버전이 됩니다.</p>
      </div>
      <ThreadsPreview body={b} brandName={brandName} />
    </div>
  );
}
