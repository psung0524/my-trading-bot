import type { ShortsBody } from "@/lib/schemas/content";

export function ShortsPreview({ body }: { body: ShortsBody }) {
  return (
    <div className="space-y-3">
      <p className="text-sm"><span className="font-medium">Hook:</span> {body.hook}</p>
      <ol className="space-y-2">
        {body.scenes.map((s) => (
          <li key={s.index} className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[80px_1fr_1fr]">
            <div className="text-xs text-muted-foreground">#{s.index + 1}<br />{s.startSec}s–{s.endSec}s</div>
            <div>
              <p className="text-xs text-muted-foreground">내레이션</p>
              <p>{s.narration}</p>
              <p className="mt-1 text-xs text-muted-foreground">장면: {s.description}</p>
            </div>
            <div className="rounded-md bg-muted/50 p-2">
              <p className="text-xs text-muted-foreground">화면 텍스트</p>
              <p className="whitespace-pre-wrap font-medium">{s.onScreenText}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="text-sm">
        <p><span className="font-medium">CTA:</span> {body.cta}</p>
        <p><span className="font-medium">제목 후보:</span> {body.titleCandidates.join(" / ")}</p>
        <p className="whitespace-pre-wrap"><span className="font-medium">설명:</span> {body.description}</p>
        <p><span className="font-medium">해시태그:</span> {body.hashtags.join(" ")}</p>
        <p><span className="font-medium">썸네일 문구:</span> {body.thumbnailText}</p>
      </div>
    </div>
  );
}
