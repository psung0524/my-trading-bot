import "server-only";

/** 현재 설정으로 실제 어떤 AI가 쓰이는지 (UI 표시용, 키 값은 노출하지 않음) */
export function aiStatus(): { provider: "mock" | "anthropic" | "openai"; model: string; configured: boolean; reason: string } {
  const mode = process.env.AI_PROVIDER ?? "mock";
  if (mode === "anthropic") {
    const ok = Boolean(process.env.ANTHROPIC_API_KEY);
    return { provider: ok ? "anthropic" : "mock", model: ok ? process.env.ANTHROPIC_MODEL || "claude-sonnet-5" : "mock-v1", configured: ok, reason: ok ? "" : "AI_PROVIDER=anthropic이지만 ANTHROPIC_API_KEY가 비어 있어 Mock으로 동작 중" };
  }
  if (mode === "openai") {
    const ok = Boolean(process.env.OPENAI_API_KEY);
    return { provider: ok ? "openai" : "mock", model: ok ? process.env.OPENAI_MODEL || "gpt-4.1-mini" : "mock-v1", configured: ok, reason: ok ? "" : "AI_PROVIDER=openai이지만 OPENAI_API_KEY가 비어 있어 Mock으로 동작 중" };
  }
  return { provider: "mock", model: "mock-v1", configured: false, reason: "AI_PROVIDER가 mock입니다. .env에 AI_PROVIDER=\"anthropic\"과 ANTHROPIC_API_KEY를 넣고 서버를 다시 시작하세요" };
}
