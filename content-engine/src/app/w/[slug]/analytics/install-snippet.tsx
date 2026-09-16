"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function InstallSnippet({ host, workspaceId, productId }: { host: string; workspaceId: string; productId: string | null }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script>
  window.ceq = window.ceq || [];
  window.ceq.push(["init", { host: "${host}", workspaceId: "${workspaceId}"${productId ? `, productId: "${productId}"` : ""} }]);
</script>
<script async src="${host}/ce-sdk.js"></script>

<!-- 이벤트 예시 (필요한 곳에서 호출) -->
<script>
  // window.ce.track("signup_started");
  // window.ce.track("signup_completed");        // 회원가입 완료
  // window.ce.track("calculator_used", { tool: "dividend" });
  // window.ce.track("stock_added"); window.ce.track("portfolio_created");
  // window.ce.track("subscription_started", { plan: "pro" });
  // window.ce.identify("내부 사용자 ID(선택, 개인정보 아님)");
</script>`;
  return (
    <div className="space-y-2">
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{snippet}</pre>
      <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}>{copied ? "복사됨" : "복사"}</Button>
      <p className="text-xs text-muted-foreground">page_view와 return_visit는 자동 수집됩니다. 추적 링크(/api/t/코드)로 들어온 방문은 utm_content로 콘텐츠에 귀속됩니다.</p>
    </div>
  );
}
