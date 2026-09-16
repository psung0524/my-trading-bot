"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LogoUpload({ slug, productId, currentUrl }: { slug: string; productId: string; currentUrl: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader>
        <CardTitle>로고</CardTitle>
        <CardDescription>PNG, JPEG, WebP · 2MB 이하. 카드뉴스와 영상에 브랜드명과 함께 표시됩니다.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-4">
        {/* 인증이 필요한 동적 스토리지 URL이라 next/image 최적화 대상이 아님 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {currentUrl ? <img src={currentUrl} alt="브랜드 로고" className="h-12 w-auto rounded border bg-white" /> : <span className="text-sm text-muted-foreground">로고 없음</span>}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("workspace", slug);
            fd.set("productId", productId);
            setBusy(true);
            try {
              const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
              const j = await res.json();
              if (!res.ok) throw new Error(j.error ?? "업로드 실패");
              toast.success("로고를 업로드했습니다");
              router.refresh();
            } catch (err) {
              toast.error((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
          className="flex items-center gap-2"
        >
          <Label htmlFor="logo-file" className="sr-only">로고 파일</Label>
          <input id="logo-file" name="file" type="file" accept="image/png,image/jpeg,image/webp" required className="text-sm" />
          <Button type="submit" size="sm" disabled={busy}>{busy ? "업로드 중..." : "업로드"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
