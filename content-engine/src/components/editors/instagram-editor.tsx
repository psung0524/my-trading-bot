"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { Card as CardT, InstagramBody } from "@/lib/schemas/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CardFrame } from "@/server/render/cardnews/card-frame";
import { cardTextWarnings } from "@/lib/card-limits";

const TYPES: { v: CardT["type"]; l: string }[] = [
  { v: "cover", l: "표지" }, { v: "calculation", l: "숫자 강조" }, { v: "comparison", l: "비교표" }, { v: "checklist", l: "체크리스트" }, { v: "step", l: "단계" }, { v: "schedule", l: "일정" }, { v: "text", l: "텍스트" }, { v: "cta", l: "CTA" },
];

export function InstagramEditor({ body, brandName, onChange }: { body: InstagramBody; brandName: string; onChange: (b: InstagramBody) => void }) {
  const [b, setB] = useState<InstagramBody>({ ...body, colors: body.colors ?? { primary: "#0F766E", secondary: "#F0FDFA", accent: "#F59E0B" } });
  const [sel, setSel] = useState(0);
  const update = (next: InstagramBody) => {
    setB(next);
    onChange(next);
  };
  const setCard = (i: number, patch: Partial<CardT>) => update({ ...b, cards: b.cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= b.cards.length) return;
    const cards = [...b.cards];
    [cards[i], cards[j]] = [cards[j], cards[i]];
    update({ ...b, cards });
    setSel(j);
  };
  const remove = (i: number) => {
    if (b.cards.length <= 3) return;
    update({ ...b, cards: b.cards.filter((_, j) => j !== i) });
    setSel(Math.max(0, i - 1));
  };
  const add = () => {
    if (b.cards.length >= 10) return;
    const c: CardT = { id: `c${Date.now()}`, type: "text", title: "새 카드", subtitle: "", body: "", label: "", value: "", items: [], rows: [], factRefs: [] };
    update({ ...b, cards: [...b.cards.slice(0, sel + 1), c, ...b.cards.slice(sel + 1)] });
    setSel(sel + 1);
  };
  const card = b.cards[sel];
  const colors = b.colors!;
  const scale = 0.32;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Label htmlFor="ig-template">템플릿</Label>
        <select id="ig-template" className="h-8 rounded-md border bg-background px-2" value={b.template} onChange={(e) => update({ ...b, template: e.target.value as InstagramBody["template"] })}>
          <option value="number-focus">숫자 강조형</option><option value="comparison">비교표형</option><option value="checklist">체크리스트형</option><option value="steps">단계 설명형</option><option value="schedule">일정형</option>
        </select>
        {(["primary", "secondary", "accent"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">{k === "primary" ? "주" : k === "secondary" ? "보조" : "강조"}</span>
            <input type="color" aria-label={`${k} 색상`} value={colors[k]} onChange={(e) => update({ ...b, colors: { ...colors, [k]: e.target.value } })} className="size-7 rounded border" />
          </label>
        ))}
        <span className="text-xs text-muted-foreground">{b.cards.length}장 (5~8장 권장)</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {b.cards.map((c, i) => {
          const warns = cardTextWarnings(c);
          return (
            <button key={c.id || i} type="button" onClick={() => setSel(i)} className={`relative shrink-0 overflow-hidden rounded-md border-2 ${i === sel ? "border-primary" : "border-transparent"}`} style={{ width: b.size.width * 0.12, height: b.size.height * 0.12 }} aria-label={`카드 ${i + 1} 선택`}>
              <div style={{ width: b.size.width, height: b.size.height, transform: `scale(0.12)`, transformOrigin: "top left" }}>
                <CardFrame card={c} index={i} total={b.cards.length} template={b.template} colors={colors} brandName={brandName} size={b.size} />
              </div>
              {warns.length > 0 && <span className="absolute right-1 top-1 rounded bg-amber-500 px-1 text-[10px] text-white">!</span>}
            </button>
          );
        })}
      </div>

      {card && (
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">카드 {sel + 1}</span>
              <select aria-label="카드 유형" className="h-8 rounded-md border bg-background px-2 text-sm" value={card.type} onChange={(e) => setCard(sel, { type: e.target.value as CardT["type"] })}>
                {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <Button type="button" size="icon" variant="ghost" aria-label="앞으로" onClick={() => move(sel, -1)}><ArrowUp className="size-4" /></Button>
              <Button type="button" size="icon" variant="ghost" aria-label="뒤로" onClick={() => move(sel, 1)}><ArrowDown className="size-4" /></Button>
              <Button type="button" size="icon" variant="ghost" aria-label="카드 추가" onClick={add}><Plus className="size-4" /></Button>
              <Button type="button" size="icon" variant="ghost" aria-label="카드 삭제" onClick={() => remove(sel)} disabled={b.cards.length <= 3}><Trash2 className="size-4" /></Button>
            </div>
            {cardTextWarnings(card).map((w) => <p key={w} className="text-xs text-amber-700">⚠ {w}</p>)}
            <div>
              <Label htmlFor="c-title">제목</Label>
              <Input id="c-title" value={card.title} onChange={(e) => setCard(sel, { title: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="c-subtitle">부제</Label>
              <Input id="c-subtitle" value={card.subtitle} onChange={(e) => setCard(sel, { subtitle: e.target.value })} className="mt-1" />
            </div>
            {(card.type === "calculation") && (
              <div className="grid gap-3 md:grid-cols-2">
                <div><Label htmlFor="c-label">라벨</Label><Input id="c-label" value={card.label} onChange={(e) => setCard(sel, { label: e.target.value })} className="mt-1" /></div>
                <div><Label htmlFor="c-value">강조 값</Label><Input id="c-value" value={card.value} onChange={(e) => setCard(sel, { value: e.target.value })} className="mt-1" /></div>
              </div>
            )}
            {(card.type === "text" || card.type === "calculation" || card.type === "cta") && (
              <div><Label htmlFor="c-body">본문</Label><Textarea id="c-body" rows={3} value={card.body} onChange={(e) => setCard(sel, { body: e.target.value })} className="mt-1" /></div>
            )}
            {(card.type === "checklist" || card.type === "step") && (
              <div><Label htmlFor="c-items">항목 (줄바꿈)</Label><Textarea id="c-items" rows={5} value={card.items.join("\n")} onChange={(e) => setCard(sel, { items: e.target.value.split("\n").filter((x) => x.trim()) })} className="mt-1" /></div>
            )}
            {(card.type === "comparison" || card.type === "schedule") && (
              <div><Label htmlFor="c-rows">행 (한 줄에 &quot;라벨 | 값&quot;)</Label><Textarea id="c-rows" rows={5} value={card.rows.map((r) => `${r.label} | ${r.value}`).join("\n")} onChange={(e) => setCard(sel, { rows: e.target.value.split("\n").filter((x) => x.includes("|")).map((l) => { const [label, value] = l.split("|").map((x) => x.trim()); return { label, value: value ?? "" }; }) })} className="mt-1" /></div>
            )}
          </div>
          <div className="overflow-hidden rounded-md border" style={{ width: b.size.width * scale, height: b.size.height * scale }}>
            <div style={{ width: b.size.width, height: b.size.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
              <CardFrame card={card} index={sel} total={b.cards.length} template={b.template} colors={colors} brandName={brandName} size={b.size} />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div><Label htmlFor="ig-caption">캡션</Label><Textarea id="ig-caption" rows={5} value={b.caption} onChange={(e) => update({ ...b, caption: e.target.value })} className="mt-1" /></div>
        <div>
          <Label htmlFor="ig-tags">해시태그 (공백 구분)</Label>
          <Textarea id="ig-tags" rows={2} value={b.hashtags.join(" ")} onChange={(e) => update({ ...b, hashtags: e.target.value.split(/\s+/).filter(Boolean) })} className="mt-1" />
          <Label htmlFor="ig-alt" className="mt-3 block">ALT 텍스트 (카드별, 줄바꿈)</Label>
          <Textarea id="ig-alt" rows={3} value={b.altTexts.join("\n")} onChange={(e) => update({ ...b, altTexts: e.target.value.split("\n") })} className="mt-1" />
        </div>
      </div>
    </div>
  );
}
