"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";
import { useHydrated, hydratedAttr } from "@/lib/use-hydrated";
import { createWorkspaceSchema, sanitizeSlugInput, slugify, type CreateWorkspaceInput } from "@/lib/schemas/workspace";
import { createWorkspaceAction } from "@/server/actions/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: "", slug: "" },
  });

  function onSubmit(values: CreateWorkspaceInput) {
    start(async () => {
      const res = await createWorkspaceAction(values);
      if (!res.ok) {
        for (const [k, msgs] of Object.entries(res.fieldErrors ?? {})) {
          form.setError(k as keyof CreateWorkspaceInput, { message: msgs[0] });
        }
        toast.error(res.error);
        return;
      }
      toast.success("워크스페이스를 만들었습니다");
      router.push(`/w/${res.data.slug}`);
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
              <FormLabel>이름</FormLabel>
              <FormControl>
                <Input
                  placeholder="예: 배당 계산기 팀"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    if (!form.formState.dirtyFields.slug) {
                      form.setValue("slug", slugify(e.target.value));
                    }
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>워크스페이스 주소 이름 (영문)</FormLabel>
              <FormControl>
                <Input placeholder="dive" {...field} onChange={(e) => field.onChange(sanitizeSlugInput(e.target.value))} />
              </FormControl>
              <FormDescription>이 앱 안에서 쓰는 짧은 이름입니다. 예: dive → /w/{field.value || "dive"}. 실제 사이트 주소는 다음 단계(제품 등록)에서 입력합니다.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "만드는 중..." : "워크스페이스 만들기"}
        </Button>
      </form>
    </Form>
  );
}
