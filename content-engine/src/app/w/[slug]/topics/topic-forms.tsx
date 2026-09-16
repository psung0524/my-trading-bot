"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createTopicAction, discoverTopicsAction } from "@/server/actions/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHydrated, hydratedAttr } from "@/lib/use-hydrated";
import { SOURCE_TYPE_LABELS } from "@/lib/labels";

const DISCOVER = ["TREND", "FREQUENTLY_VIEWED", "PRODUCT_DATA", "EDUCATIONAL", "COMMUNITY_QUESTION"];

export function TopicForms({ slug, productId }: { slug: string; productId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hydrated = useHydrated();

  function submit(input: Record<string, unknown>) {
    start(async () => {
      const res = await createTopicAction(slug, productId, input);
      if (!res.ok) {
        const first = Object.values(res.fieldErrors ?? {})[0]?.[0];
        return void toast.error(first ?? res.error);
      }
      toast.success("소재를 추가했습니다");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>소재 만들기</CardTitle>
        <CardDescription>MVP에서는 직접 입력·사용자 질문·계산·기능 업데이트를 실제로 처리하고, 나머지 유형은 예시 데이터로 후보를 제안합니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="CALCULATION">
          <TabsList className="flex-wrap">
            <TabsTrigger value="CALCULATION">계산</TabsTrigger>
            <TabsTrigger value="USER_QUESTION">사용자 질문</TabsTrigger>
            <TabsTrigger value="MANUAL_INPUT">직접 입력</TabsTrigger>
            <TabsTrigger value="FEATURE_UPDATE">기능 업데이트</TabsTrigger>
          </TabsList>

          <TabsContent value="CALCULATION">
            <CalcForm onSubmit={submit} pending={pending} hydrated={hydrated} />
          </TabsContent>
          <TabsContent value="USER_QUESTION">
            <QuestionForm onSubmit={submit} pending={pending} hydrated={hydrated} />
          </TabsContent>
          <TabsContent value="MANUAL_INPUT">
            <ManualForm onSubmit={submit} pending={pending} hydrated={hydrated} />
          </TabsContent>
          <TabsContent value="FEATURE_UPDATE">
            <FeatureForm onSubmit={submit} pending={pending} hydrated={hydrated} />
          </TabsContent>
        </Tabs>

        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium">후보 자동 발견 (예시 데이터)</p>
          <div className="flex flex-wrap gap-2">
            {DISCOVER.map((t) => (
              <Button
                key={t}
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await discoverTopicsAction(slug, productId, t);
                    if (!res.ok) return void toast.error(res.error);
                    toast.success(`${SOURCE_TYPE_LABELS[t]} 후보 ${res.data.count}개를 추가했습니다`);
                    router.refresh();
                  })
                }
              >
                {SOURCE_TYPE_LABELS[t]}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FormProps = { onSubmit: (i: Record<string, unknown>) => void; pending: boolean; hydrated: boolean };

function CalcForm({ onSubmit, pending, hydrated }: FormProps) {
  const [monthly, setMonthly] = useState("500000");
  const [yields, setYields] = useState("3, 4, 5");
  return (
    <form
      className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
      noValidate
      {...hydratedAttr(hydrated)}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ sourceType: "CALCULATION", monthlyTarget: Number(monthly), yields });
      }}
    >
      <div>
        <Label htmlFor="calc-monthly">월 목표 배당금 (원)</Label>
        <Input id="calc-monthly" inputMode="numeric" value={monthly} onChange={(e) => setMonthly(e.target.value.replace(/[^\d]/g, ""))} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="calc-yields">배당수익률 시나리오 (%)</Label>
        <Input id="calc-yields" value={yields} onChange={(e) => setYields(e.target.value)} className="mt-1" placeholder="3, 4, 5" />
      </div>
      <Button type="submit" disabled={pending}>계산 소재 추가</Button>
      <p className="text-xs text-muted-foreground md:col-span-3">필요 투자금 = 월 목표 × 12 ÷ 배당수익률. 세금·환율은 반영하지 않으며 결과에 주의사항이 자동으로 붙습니다.</p>
    </form>
  );
}

function QuestionForm({ onSubmit, pending, hydrated }: FormProps) {
  const [question, setQuestion] = useState("");
  const [context, setContext] = useState("");
  return (
    <form className="space-y-3" noValidate {...hydratedAttr(hydrated)} onSubmit={(e) => { e.preventDefault(); onSubmit({ sourceType: "USER_QUESTION", question, context }); }}>
      <div>
        <Label htmlFor="q-question">사용자 질문</Label>
        <Input id="q-question" value={question} onChange={(e) => setQuestion(e.target.value)} className="mt-1" placeholder="예: 배당락일 전에 사면 배당을 받을 수 있나요?" />
      </div>
      <div>
        <Label htmlFor="q-context">배경 (선택)</Label>
        <Textarea id="q-context" rows={2} value={context} onChange={(e) => setContext(e.target.value)} className="mt-1" />
      </div>
      <Button type="submit" disabled={pending}>질문 소재 추가</Button>
    </form>
  );
}

function ManualForm({ onSubmit, pending, hydrated }: FormProps) {
  const [title, setTitle] = useState("");
  const [coreQuestion, setCoreQuestion] = useState("");
  const [category, setCategory] = useState("INFORMATIONAL");
  const [notes, setNotes] = useState("");
  return (
    <form className="space-y-3" noValidate {...hydratedAttr(hydrated)} onSubmit={(e) => { e.preventDefault(); onSubmit({ sourceType: "MANUAL_INPUT", title, coreQuestion, category, notes }); }}>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="m-title">제목</Label>
          <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="m-category">콘텐츠 유형</Label>
          <select id="m-category" className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="INFORMATIONAL">정보형</option>
            <option value="DATA">데이터형</option>
            <option value="ENGAGEMENT">참여형</option>
            <option value="BRANDING">브랜딩·제작 과정</option>
            <option value="PROMOTION">직접 홍보</option>
          </select>
        </div>
      </div>
      <div>
        <Label htmlFor="m-core">핵심 질문</Label>
        <Input id="m-core" value={coreQuestion} onChange={(e) => setCoreQuestion(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="m-notes">근거 메모 (출처·수치가 있으면 여기에)</Label>
        <Textarea id="m-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1" />
      </div>
      <Button type="submit" disabled={pending}>소재 추가</Button>
    </form>
  );
}

function FeatureForm({ onSubmit, pending, hydrated }: FormProps) {
  const [featureName, setFeatureName] = useState("");
  const [summary, setSummary] = useState("");
  const [url, setUrl] = useState("");
  return (
    <form className="space-y-3" noValidate {...hydratedAttr(hydrated)} onSubmit={(e) => { e.preventDefault(); onSubmit({ sourceType: "FEATURE_UPDATE", featureName, summary, url }); }}>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="f-name">기능 이름</Label>
          <Input id="f-name" value={featureName} onChange={(e) => setFeatureName(e.target.value)} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="f-url">안내 페이지 URL (선택)</Label>
          <Input id="f-url" value={url} onChange={(e) => setUrl(e.target.value)} className="mt-1" />
        </div>
      </div>
      <div>
        <Label htmlFor="f-summary">무엇이 달라졌나요?</Label>
        <Textarea id="f-summary" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} className="mt-1" />
      </div>
      <Button type="submit" disabled={pending}>기능 소재 추가</Button>
    </form>
  );
}
