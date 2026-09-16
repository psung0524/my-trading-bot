/** 기본 브랜드 포지셔닝과 금지 표현 (요구사항 §5) */
export const DEFAULT_FORBIDDEN_PHRASES = [
  "무조건 오른다",
  "확실한 수익",
  "반드시 사야 한다",
  "지금 사면 돈을 번다",
  "손실이 없다",
  "최고의 종목",
  "인생 종목",
  "이 종목만 사면 된다",
];

export const DEFAULT_PREFERRED_PHRASES = [
  "기준일 기준으로",
  "조건에 따라 달라질 수 있습니다",
  "직접 계산해 보세요",
  "참고용 정보입니다",
];

export const DEFAULT_TONE =
  "차분하고 쉬운 표현. 과장하거나 불안을 조성하지 않는다. 숫자에는 조건과 기준일을 함께 표시한다.";

export const DEFAULT_OPERATOR_IDENTITY =
  "종목을 추천하는 전문가가 아니라, 복잡한 배당 정보를 쉽게 계산하고 정리해 주는 도구를 만드는 운영자";

export const DEFAULT_CONTENT_GOAL =
  "배당 관련 데이터와 계산 정보를 이해하기 쉽게 콘텐츠로 만들어 웹서비스로 자연스럽게 유입시킨다";

export const DEFAULT_TARGET_AUDIENCE = "배당 투자를 시작했거나 관심 있는 개인 투자자";

export const DEFAULT_FINANCE_DISCLAIMER =
  "이 콘텐츠는 정보 제공 목적이며 특정 종목의 매수·매도를 권유하지 않습니다. 배당금은 변동되거나 삭감될 수 있고, 세금과 환율은 반영되지 않았습니다. 투자 판단과 책임은 본인에게 있습니다.";

export const DEFAULT_CTAS = [
  { label: "내 목표 배당금 계산하기", url: "", strength: "medium" as const },
];

export const DEFAULT_CHANNEL_SETTINGS = {
  threads: { includeLink: true, ctaStrength: "low", lessAdLike: true },
  instagram: { cardCount: 6, template: "magazine" },
  blog: { includeFaq: true, includeToc: true },
  youtube: { durationSec: 45 },
};
