from __future__ import annotations
from dataclasses import dataclass
import pandas as pd

@dataclass
class MarketRegime:
    label: str; score: int; action: str; reasons: list[str]

def classify_market(index_history: pd.DataFrame) -> MarketRegime:
    """Needs close column; works with a provider-neutral dataframe."""
    if index_history is None or len(index_history) < 20 or 'close' not in index_history:
        return MarketRegime('데이터 확인 필요', 50, '신규 진입을 보수적으로 검토', ['지수 이력이 충분하지 않습니다.'])
    close = index_history['close'].astype(float); last = close.iloc[-1]
    ma20, ma60 = close.tail(20).mean(), close.tail(min(60, len(close))).mean()
    momentum = (last / close.iloc[-20] - 1) * 100
    if last > ma20 > ma60 and momentum > 0:
        return MarketRegime('상승 추세', 78, '돌파·추세추종 후보를 우선 검토', ['지수가 20/60일선 상단', f'20일 모멘텀 {momentum:.1f}%'])
    if last < ma20 < ma60:
        return MarketRegime('위험회피', 28, '신규 진입 축소·현금 및 손절 규칙 우선', ['지수가 20/60일선 하단'])
    return MarketRegime('박스권/혼조', 52, '눌림·짧은 손절 기준의 제한적 접근', ['추세 신호가 혼재'])
