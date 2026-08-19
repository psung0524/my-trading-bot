from __future__ import annotations
from .models import ScoreResult, StockSnapshot, TradePlan

def alpha_score(s: StockSnapshot, theme_rank: int | None = None) -> ScoreResult:
    c: dict[str, int] = {}; reasons: list[str] = []
    trend = s.ma5 > s.ma10 > s.ma20 > s.ma60 > s.ma120
    c['trend'] = 20 if trend else (12 if s.price > s.ma20 > s.ma60 else 4)
    if trend: reasons.append('이동평균 정배열')
    strategy_score = min(30, len(s.strategies) * 10); c['strategies'] = strategy_score
    if s.strategies: reasons.append(f"{len(s.strategies)}개 전략 동시 충족: {', '.join(s.strategies)}")
    c['volume'] = 15 if s.volume_ratio >= 3 else (10 if s.volume_ratio >= 1.5 else 3)
    if s.volume_ratio >= 1.5: reasons.append(f'거래량 {s.volume_ratio:.1f}배')
    c['turnover'] = 20 if s.turnover_ratio >= 2 else (12 if s.turnover_ratio >= 1 else 4)
    c['momentum'] = 10 if s.change_pct >= 3 else (6 if s.change_pct > 0 else 0)
    if s.high_52w_distance >= -2: reasons.append('52주 고점 부근/돌파')
    c['theme'] = 5 if theme_rank and theme_rank <= 3 else 0
    total = min(100, sum(c.values()))
    grade = '핵심 후보' if total >= 85 else '매수 관심' if total >= 75 else '관찰' if total >= 65 else '대기'
    return ScoreResult(total, grade, reasons or ['강한 복합 신호 없음'], c)

def build_trade_plan(s: StockSnapshot, stop_pct: float = 0.06) -> TradePlan:
    entry = s.price
    structural_stop = s.ma20 * 0.985 if s.ma20 > 0 else entry * (1 - stop_pct)
    stop = max(entry * (1 - stop_pct), structural_stop) if structural_stop < entry else entry * (1 - stop_pct)
    risk = max(entry - stop, entry * 0.01)
    return TradePlan(entry, stop, entry + risk, entry + risk*2, entry + risk*3,
                     risk / entry * 100,
                     ['종가 기준 진입 가격 이상 유지', '거래량/시장 환경 재확인', '사전 정의한 최대 손실 한도 내 포지션'],
                     ['종가 기준 손절가 이탈', '핵심 전략 신호 소멸', '시장 국면이 위험회피로 전환'])
