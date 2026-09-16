import type { ThreadsBody } from "@/lib/schemas/content";

export function ThreadsPreview({ body, brandName }: { body: ThreadsBody; brandName: string }) {
  return (
    <div className="mx-auto max-w-md rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <div className="size-9 rounded-full bg-primary/20" aria-hidden />
        <div>
          <p className="text-sm font-semibold">{brandName}</p>
          <p className="text-xs text-muted-foreground">방금 전</p>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{body.text}</p>
      <p className="mt-3 text-xs text-muted-foreground">{body.text.length} / 500자</p>
    </div>
  );
}
