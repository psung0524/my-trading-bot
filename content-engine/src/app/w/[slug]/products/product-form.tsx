"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";
import { productSchema, type ProductFormInput, type ProductInput } from "@/lib/schemas/product";
import { createProductAction, updateProductAction } from "@/server/actions/product";
import { useHydrated, hydratedAttr } from "@/lib/use-hydrated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export function ProductForm({
  slug,
  mode,
  productId,
  defaults,
}: {
  slug: string;
  mode: "create" | "edit";
  productId?: string;
  defaults?: Partial<ProductInput>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const form = useForm<ProductFormInput, unknown, ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: defaults?.name ?? "", url: defaults?.url ?? "", description: defaults?.description ?? "" },
  });

  function onSubmit(values: ProductInput) {
    start(async () => {
      if (mode === "create") {
        const res = await createProductAction(slug, values);
        if (!res.ok) {
          for (const [k, msgs] of Object.entries(res.fieldErrors ?? {})) form.setError(k as keyof ProductFormInput, { message: msgs[0] });
          toast.error(res.error);
          return;
        }
        toast.success("제품을 등록했습니다. 페이지를 분석해 보세요.");
        router.push(`/w/${slug}/products/${res.data.productId}?step=analyze`);
      } else if (productId) {
        const res = await updateProductAction(slug, productId, values);
        if (!res.ok) return void toast.error(res.error);
        toast.success("저장했습니다");
        router.refresh();
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate {...hydratedAttr(hydrated)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>제품 이름</FormLabel>
              <FormControl>
                <Input placeholder="예: 배당 계산기" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>서비스 URL</FormLabel>
              <FormControl>
                <Input type="url" placeholder="https://example.com" {...field} />
              </FormControl>
              <FormDescription>추적 링크와 CTA의 기본 목적지로 사용됩니다.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>설명</FormLabel>
              <FormControl>
                <Textarea rows={4} placeholder="서비스가 어떤 문제를 해결하는지 간단히 적어 주세요" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending}>
          {pending ? "저장 중..." : mode === "create" ? "등록하고 분석하기" : "저장"}
        </Button>
      </form>
    </Form>
  );
}
