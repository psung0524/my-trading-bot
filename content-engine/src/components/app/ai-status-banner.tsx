export function AiStatusBanner({ status }: { status: { provider: string; model: string; configured: boolean; reason: string } }) {
  if (status.configured) {
    return <p className="rounded-md border bg-accent/40 px-3 py-2 text-xs">AI: <span className="font-medium">{status.provider} · {status.model}</span></p>;
  }
  return (
    <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="font-semibold">지금은 Mock(예시 문장)으로 생성됩니다.</span> {status.reason}. 키를 넣은 뒤에는 <code>npm run dev</code>를 껐다 켜야 반영됩니다.
    </p>
  );
}
