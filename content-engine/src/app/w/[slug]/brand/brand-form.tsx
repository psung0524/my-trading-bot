"use client";

import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { brandProfileSchema, type BrandProfileFormInput, type BrandProfileInput } from "@/lib/schemas/product";
import { saveBrandProfileAction } from "@/server/actions/brand";
import { useHydrated, hydratedAttr } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

function PhraseList({
  label,
  description,
  values,
  onChange,
  placeholder,
  testId,
}: {
  label: string;
  description?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  testId: string;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setDraft("");
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 pr-1">
            {v}
            <button type="button" aria-label={`${v} 삭제`} onClick={() => onChange(values.filter((x) => x !== v))} className="rounded-full p-0.5 hover:bg-muted">
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        {values.length === 0 && <span className="text-xs text-muted-foreground">없음</span>}
      </div>
      <div className="flex gap-2">
        <Input
          data-testid={testId}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={add}>
          추가
        </Button>
      </div>
    </div>
  );
}

export function BrandProfileForm({ slug, productId, defaults, productUrl }: { slug: string; productId: string; defaults: BrandProfileInput; productUrl: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const form = useForm<BrandProfileFormInput, unknown, BrandProfileInput>({ resolver: zodResolver(brandProfileSchema), defaultValues: defaults });
  const ctas = useFieldArray({ control: form.control, name: "ctas" });

  function onSubmit(values: BrandProfileInput) {
    start(async () => {
      const res = await saveBrandProfileAction(slug, productId, values);
      if (!res.ok) {
        for (const [k, msgs] of Object.entries(res.fieldErrors ?? {})) form.setError(k as keyof BrandProfileFormInput, { message: msgs[0] });
        toast.error(res.error);
        return;
      }
      toast.success("브랜드 프로필을 저장했습니다");
      router.refresh();
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate {...hydratedAttr(hydrated)}>
        <Card>
          <CardHeader>
            <CardTitle>정체성</CardTitle>
            <CardDescription>종목을 추천하는 전문가가 아니라, 복잡한 정보를 쉽게 계산·정리해 주는 도구라는 포지셔닝이 기본값입니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField control={form.control} name="brandName" render={({ field }) => (
              <FormItem><FormLabel>브랜드명</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="tagline" render={({ field }) => (
              <FormItem><FormLabel>한 줄 설명</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="operatorIdentity" render={({ field }) => (
              <FormItem className="md:col-span-2"><FormLabel>운영자 정체성</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="targetAudience" render={({ field }) => (
              <FormItem><FormLabel>핵심 타깃</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="contentGoal" render={({ field }) => (
              <FormItem><FormLabel>콘텐츠 목적</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>말투와 표현</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField control={form.control} name="tone" render={({ field }) => (
              <FormItem><FormLabel>말투</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl>
                <FormDescription>차분하고 쉬운 표현, 과장·불안 조성 금지, 숫자에는 조건과 기준일 표시가 기본입니다.</FormDescription><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="preferredPhrases" render={({ field }) => (
              <FormItem>
                <PhraseList label="선호 표현" values={field.value ?? []} onChange={field.onChange} placeholder="예: 기준일 기준으로" testId="preferred-input" />
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="forbiddenPhrases" render={({ field }) => (
              <FormItem>
                <PhraseList
                  label="금지 표현"
                  description="이 표현이 포함된 콘텐츠는 안전 검사에서 차단됩니다."
                  values={field.value ?? []}
                  onChange={field.onChange}
                  placeholder="예: 무조건 오른다"
                  testId="forbidden-input"
                />
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="financeDisclaimer" render={({ field }) => (
              <FormItem><FormLabel>금융 면책 표현</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CTA 목록</CardTitle>
            <CardDescription>비워 두면 제품 URL({productUrl})을 사용합니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ctas.fields.map((f, i) => (
              <div key={f.id} className="grid gap-2 md:grid-cols-[1fr_1fr_120px_auto]">
                <FormField control={form.control} name={`ctas.${i}.label`} render={({ field }) => (
                  <FormItem><FormControl><Input placeholder="문구" aria-label={`CTA ${i + 1} 문구`} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name={`ctas.${i}.url`} render={({ field }) => (
                  <FormItem><FormControl><Input placeholder="URL (선택)" aria-label={`CTA ${i + 1} URL`} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name={`ctas.${i}.strength`} render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" aria-label={`CTA ${i + 1} 강도`} {...field}>
                        <option value="low">약하게</option>
                        <option value="medium">보통</option>
                        <option value="high">강하게</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
                <Button type="button" variant="ghost" size="icon" aria-label="CTA 삭제" onClick={() => ctas.remove(i)}>
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => ctas.append({ label: "", url: "", strength: "medium" })}>
              CTA 추가
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>디자인</CardTitle>
            <CardDescription>카드뉴스와 영상 템플릿에 적용됩니다.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            {(["primaryColor", "secondaryColor", "accentColor"] as const).map((name) => (
              <FormField key={name} control={form.control} name={name} render={({ field }) => (
                <FormItem>
                  <FormLabel>{name === "primaryColor" ? "주 색상" : name === "secondaryColor" ? "보조 색상" : "강조 색상"}</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <input type="color" value={field.value} onChange={(e) => field.onChange(e.target.value)} aria-label={`${name} 선택`} className="size-9 rounded border" />
                      <Input {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            ))}
            <FormField control={form.control} name="fontFamily" render={({ field }) => (
              <FormItem><FormLabel>폰트</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </CardContent>
        </Card>

        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : "브랜드 프로필 저장"}
        </Button>
      </form>
    </Form>
  );
}
