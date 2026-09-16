"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">문제가 발생했습니다</h1>
      <p className="max-w-md text-sm text-muted-foreground">{error.message || "알 수 없는 오류"}{error.digest ? ` (참조: ${error.digest})` : ""}</p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
