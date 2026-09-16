import type { Fact, ValidationIssue } from "@/lib/schemas/content";
import { parseKoreanNumbers } from "@/lib/format/number-ko";

/**
 * 금융 콘텐츠 안전 검사 모듈 (요구사항 §15).
 * 텍스트 단위로 검사하며 BLOCK 이슈가 하나라도 있으면 게시가 차단된다.
 */

const GUARANTEE_PATTERNS = [
  /무조건\s*(오른|올라|수익|번다)/, /확실한?\s*수익/, /수익\s*보장/, /손실\s*(이\s*)?없/, /원금\s*보장/, /100%\s*(수익|안전)/, /반드시\s*(오른|수익|번다)/, /절대\s*(안전|손해\s*없)/,
];
const DIRECTIVE_PATTERNS = [
  /(지금|당장|오늘)\s*(사|매수|팔|매도)(세요|해야|하세요|해라|해)/, /반드시\s*(사|매수|팔|매도)/, /(사야|매수해야|팔아야|매도해야)\s*(한다|합니다|해요|함)/, /이\s*종목만\s*사/, /(풀매수|몰빵|올인)/,
];
const FEAR_PATTERNS = [/(지금\s*안\s*사면|놓치면)\s*(후회|끝|망)/, /(폭락|폭등)\s*(확정|온다|임박)/, /(마지막\s*기회)/, /(다\s*잃|전\s*재산)/];
const MISLEADING_COMPARISON = [/(은행|예금)\s*(보다|대비)\s*(무조건|항상|훨씬)\s*(낫|좋|유리)/, /(최고|최강|1등)의?\s*(종목|배당주|ETF)/, /인생\s*종목/];

export type SafetyContext = {
  facts: Fact[];
  asOfDate: string;
  cautions: string[];
  forbiddenPhrases: string[];
  /** 기준일 표기 필수 여부 (Threads 등 짧은 채널도 필수) */
  requireAsOfDate?: boolean;
};

export function checkFinanceSafety(text: string, ctx: SafetyContext, location = ""): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (code: string, severity: ValidationIssue["severity"], message: string, excerpt = "") => issues.push({ code, severity, message, location, excerpt });

  for (const re of GUARANTEE_PATTERNS) {
    const m = text.match(re);
    if (m) push("GUARANTEE", "BLOCK", "수익 보장으로 읽히는 표현이 있습니다", m[0]);
  }
  for (const re of DIRECTIVE_PATTERNS) {
    const m = text.match(re);
    if (m) push("DIRECTIVE", "BLOCK", "직접적인 매수·매도 지시 표현이 있습니다", m[0]);
  }
  for (const re of FEAR_PATTERNS) {
    const m = text.match(re);
    if (m) push("FEAR", "BLOCK", "과도한 불안을 조성하는 표현이 있습니다", m[0]);
  }
  for (const re of MISLEADING_COMPARISON) {
    const m = text.match(re);
    if (m) push("MISLEADING", "BLOCK", "오해를 부르는 비교·최상급 표현이 있습니다", m[0]);
  }
  for (const phrase of ctx.forbiddenPhrases) {
    const p = phrase.trim();
    if (p && text.includes(p)) push("FORBIDDEN_PHRASE", "BLOCK", `브랜드 금지 표현 "${p}"이(가) 포함되어 있습니다`, p);
  }

  const numbers = parseKoreanNumbers(text);
  const hasMoney = numbers.some((n) => n.kind === "number" && n.value >= 10_000) || numbers.some((n) => n.kind === "percent");
  if (hasMoney) {
    if ((ctx.requireAsOfDate ?? true) && !text.includes(ctx.asOfDate) && !/기준일/.test(text)) {
      push("MISSING_AS_OF_DATE", "WARN", `금액·비율이 있지만 기준일(${ctx.asOfDate}) 표기가 없습니다`);
    }
    const mentionsTax = /세금|세전|세후|배당소득세/.test(text);
    const mentionsFx = /환율/.test(text);
    const isKrwOnly = ctx.facts.every((f) => f.unit !== "USD");
    if (!mentionsTax) push("MISSING_TAX_NOTE", "WARN", "세금 조건(세전/세후, 미반영 여부) 언급이 없습니다");
    if (!mentionsFx && !isKrwOnly) push("MISSING_FX_NOTE", "WARN", "환율 조건 언급이 없습니다");
  }

  return issues;
}
