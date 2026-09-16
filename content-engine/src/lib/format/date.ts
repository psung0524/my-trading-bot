/** 서버/클라이언트에서 동일한 결과를 내도록 시간대를 고정한 날짜 포맷 (hydration 불일치 방지) */
const TZ = "Asia/Seoul";

export function formatDateTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
}

export function formatDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("ko-KR", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function toDateInput(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  return d.toISOString().slice(0, 10);
}

/** 렌더 중 Date.now() 직접 호출을 피하기 위한 헬퍼 */
export function daysAgo(n: number, from: Date = new Date()): Date {
  return new Date(from.getTime() - n * 86400_000);
}
