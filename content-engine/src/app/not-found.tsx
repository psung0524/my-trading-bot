import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="text-sm text-muted-foreground">주소가 잘못되었거나 접근 권한이 없는 항목입니다.</p>
      <Button asChild><Link href="/onboarding">워크스페이스로</Link></Button>
    </main>
  );
}
