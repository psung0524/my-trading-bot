"use client";

import { useState } from "react";
import type { ShortsBody, ShortsScene } from "@/lib/schemas/content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function ShortsEditor({ body, onChange }: { body: ShortsBody; onChange: (b: ShortsBody) => void }) {
  const [b, setB] = useState(body);
  const update = (patch: Partial<ShortsBody>) => {
    const next = { ...b, ...patch };
    setB(next);
    onChange(next);
  };
  const setScene = (i: number, patch: Partial<ShortsScene>) => update({ scenes: b.scenes.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const removeScene = (i: number) => {
    if (b.scenes.length <= 2) return;
    update({ scenes: b.scenes.filter((_, j) => j !== i).map((s, idx) => ({ ...s, index: idx })) });
  };
  const addScene = (i: number) => {
    if (b.scenes.length >= 12) return;
    const s: ShortsScene = { index: i + 1, startSec: 0, endSec: 0, narration: "", onScreenText: "", description: "", subtitle: "", factRefs: [] };
    update({ scenes: [...b.scenes.slice(0, i + 1), s, ...b.scenes.slice(i + 1)].map((x, idx) => ({ ...x, index: idx })) });
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label htmlFor="s-dur">길이</Label>
          <select id="s-dur" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={b.durationSec} onChange={(e) => update({ durationSec: Number(e.target.value) as 30 | 45 | 60 })}>
            <option value={30}>30초</option><option value={45}>45초</option><option value={60}>60초</option>
          </select>
        </div>
        <div className="md:col-span-2"><Label htmlFor="s-hook">첫 3초 Hook</Label><Input id="s-hook" value={b.hook} onChange={(e) => update({ hook: e.target.value })} className="mt-1" /></div>
      </div>
      <p className="text-xs text-muted-foreground">장면 시간은 음성 길이에 맞춰 렌더링 시 자동 조정됩니다. 자막은 화면 하단 Safe Area 안에 표시됩니다.</p>
      <ol className="space-y-3">
        {b.scenes.map((s, i) => (
          <li key={i} className="rounded-md border p-3">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">장면 {i + 1} <span className="text-xs text-muted-foreground">{s.startSec}s–{s.endSec}s</span></span>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => addScene(i)}>아래 추가</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeScene(i)} disabled={b.scenes.length <= 2}>삭제</Button>
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div><Label htmlFor={`sc-n-${i}`}>내레이션</Label><Textarea id={`sc-n-${i}`} rows={2} value={s.narration} onChange={(e) => setScene(i, { narration: e.target.value, subtitle: s.subtitle === s.narration ? e.target.value : s.subtitle })} className="mt-1" /></div>
              <div><Label htmlFor={`sc-t-${i}`}>화면 텍스트 (2줄 이내)</Label><Textarea id={`sc-t-${i}`} rows={2} value={s.onScreenText} onChange={(e) => setScene(i, { onScreenText: e.target.value })} className="mt-1" /></div>
              <div><Label htmlFor={`sc-d-${i}`}>장면 설명</Label><Input id={`sc-d-${i}`} value={s.description} onChange={(e) => setScene(i, { description: e.target.value })} className="mt-1" /></div>
              <div><Label htmlFor={`sc-s-${i}`}>자막</Label><Input id={`sc-s-${i}`} value={s.subtitle} onChange={(e) => setScene(i, { subtitle: e.target.value })} className="mt-1" /></div>
            </div>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label htmlFor="s-cta">CTA</Label><Input id="s-cta" value={b.cta} onChange={(e) => update({ cta: e.target.value })} className="mt-1" /></div>
        <div><Label htmlFor="s-thumb">썸네일 문구</Label><Input id="s-thumb" value={b.thumbnailText} onChange={(e) => update({ thumbnailText: e.target.value })} className="mt-1" /></div>
        <div><Label htmlFor="s-titles">제목 후보 (줄바꿈)</Label><Textarea id="s-titles" rows={3} value={b.titleCandidates.join("\n")} onChange={(e) => update({ titleCandidates: e.target.value.split("\n").filter(Boolean) })} className="mt-1" /></div>
        <div><Label htmlFor="s-desc">설명</Label><Textarea id="s-desc" rows={3} value={b.description} onChange={(e) => update({ description: e.target.value })} className="mt-1" /></div>
        <div className="md:col-span-2"><Label htmlFor="s-tags">해시태그 (공백 구분)</Label><Input id="s-tags" value={b.hashtags.join(" ")} onChange={(e) => update({ hashtags: e.target.value.split(/\s+/).filter(Boolean) })} className="mt-1" /></div>
      </div>
    </div>
  );
}
