"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addBrandRuleAction, deleteBrandRuleAction, toggleBrandRuleAction } from "@/server/actions/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const KINDS: Record<string, string> = {
  FORBIDDEN_PHRASE: "금지 표현",
  PREFERRED_PHRASE: "선호 표현",
  TONE: "말투",
  DISCLAIMER: "면책",
  CTA: "CTA",
  CUSTOM: "기타",
};

export function BrandRules({
  slug,
  productId,
  rules,
}: {
  slug: string;
  productId: string;
  rules: { id: string; kind: string; value: string; note: string; enabled: boolean }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState("CUSTOM");
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>브랜드 규칙</CardTitle>
        <CardDescription>프로필 외에 추가로 적용할 규칙입니다. 끄면 생성과 검사에서 제외됩니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-md border text-sm">
          {rules.length === 0 && <li className="p-2 text-muted-foreground">규칙이 없습니다.</li>}
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-2">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">{KINDS[r.kind] ?? r.kind}</span>
              <span className="min-w-0 flex-1">
                <span className={r.enabled ? "" : "line-through opacity-60"}>{r.value}</span>
                {r.note && <span className="ml-2 text-xs text-muted-foreground">{r.note}</span>}
              </span>
              <Switch
                checked={r.enabled}
                aria-label={`${r.value} 규칙 사용`}
                onCheckedChange={(v) =>
                  start(async () => {
                    const res = await toggleBrandRuleAction(slug, r.id, v);
                    if (!res.ok) toast.error(res.error);
                    router.refresh();
                  })
                }
              />
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteBrandRuleAction(slug, r.id);
                    if (!res.ok) toast.error(res.error);
                    router.refresh();
                  })
                }
              >
                삭제
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="flex flex-col gap-2 md:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await addBrandRuleAction(slug, productId, { kind, value, note });
              if (!res.ok) return void toast.error(res.error);
              setValue("");
              setNote("");
              toast.success("규칙을 추가했습니다");
              router.refresh();
            });
          }}
        >
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value)} aria-label="규칙 종류">
            {Object.entries(KINDS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="규칙 내용" aria-label="규칙 내용" required />
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="메모 (선택)" aria-label="규칙 메모" />
          <Button type="submit" disabled={pending}>추가</Button>
        </form>
      </CardContent>
    </Card>
  );
}
