"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { toast } from "sonner";
import { useHydrated, hydratedAttr } from "@/lib/use-hydrated";
import { signupSchema, type SignupInput } from "@/lib/schemas/auth";
import { signupAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export function SignupForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const hydrated = useHydrated();
  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  function onSubmit(values: SignupInput) {
    start(async () => {
      const res = await signupAction(values);
      if (!res.ok) {
        for (const [k, msgs] of Object.entries(res.fieldErrors ?? {})) {
          form.setError(k as keyof SignupInput, { message: msgs[0] });
        }
        toast.error(res.error);
        return;
      }
      toast.success("가입이 완료되었습니다");
      router.push("/onboarding");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>회원가입</CardTitle>
        <CardDescription>이메일로 계정을 만듭니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate {...hydratedAttr(hydrated)}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이름</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" placeholder="홍길동" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이메일</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" placeholder="you@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>비밀번호</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="new-password" placeholder="8자 이상" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "가입 중..." : "가입하기"}
            </Button>
          </form>
        </Form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="text-primary underline">
            로그인
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
