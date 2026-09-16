import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/auth";

const LOOP = [
  "제품 분석",
  "소재 발견",
  "검증된 원본",
  "채널 변환",
  "이미지·영상",
  "검토·승인",
  "게시·내보내기",
  "유입·전환 측정",
  "다음 콘텐츠 반영",
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  return (
    <main className="flex-1">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-bold">
            Content Engine
          </Link>
          <nav className="flex items-center gap-2">
            {user ? (
              <Button asChild size="sm">
                <Link href="/onboarding">워크스페이스로 이동</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">로그인</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/signup">무료로 시작</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-4 py-16 md:py-24">
        <p className="text-sm font-medium text-primary">웹서비스 운영자를 위한 AI 마케팅 직원</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
          서비스 URL을 연결하면
          <br />
          검증된 콘텐츠가 채널별로 만들어집니다
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          제품과 데이터를 분석해 소재를 찾고, 숫자와 기준일이 검증된 Content Master를 만든 뒤 Threads·Instagram
          카드뉴스·블로그·YouTube Shorts로 변환합니다. 게시는 항상 사용자의 승인 뒤에만 이루어집니다.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg">
            <Link href="/signup">무료로 시작하기</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/login">로그인</Link>
          </Button>
        </div>
        <ol className="mt-14 grid grid-cols-2 gap-2 text-sm md:grid-cols-3 lg:grid-cols-9">
          {LOOP.map((step, i) => (
            <li key={step} className="rounded-md border bg-card p-3">
              <span className="block text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <span className="font-medium">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-10 rounded-md border bg-muted/40 p-4 text-xs text-muted-foreground">
          첫 번째 적용 분야는 배당주 투자자를 위한 웹서비스입니다. 특정 종목의 매수·매도를 권하거나 수익을 보장하는
          콘텐츠는 만들지 않으며, 금융 안전 검사를 통과하지 못한 콘텐츠는 게시가 차단됩니다.
        </p>
      </section>
    </main>
  );
}
