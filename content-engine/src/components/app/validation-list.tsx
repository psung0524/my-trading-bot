import type { ValidationIssue } from "@/lib/schemas/content";
import { Badge } from "@/components/ui/badge";

export function ValidationList({ issues, emptyText = "이슈가 없습니다." }: { issues: ValidationIssue[]; emptyText?: string }) {
  if (issues.length === 0) return <p className="text-sm text-emerald-700">{emptyText}</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {issues.map((i, idx) => (
        <li key={idx} className="flex items-start gap-2 rounded-md border p-2">
          <Badge variant={i.severity === "BLOCK" ? "destructive" : i.severity === "WARN" ? "secondary" : "outline"}>{i.severity}</Badge>
          <div className="min-w-0">
            <p>{i.message}</p>
            <p className="text-xs text-muted-foreground">
              {i.code}
              {i.location ? ` · ${i.location}` : ""}
              {i.excerpt ? ` · "${i.excerpt}"` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
