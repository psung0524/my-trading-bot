"""Explicit, auditable rules for the five trading setups and exit playbook.

Every rule returns reasons and failures. It must be evaluated with timestamped,
adjusted OHLCV data; it does not place orders or make a recommendation.
"""
from __future__ import annotations
from dataclasses import dataclass

MIN_MARKET_CAP = 100_000_000_000  # KRW 100bn
MIN_TRADING_VALUE = 30_000_000_000  # KRW 30bn

@dataclass(frozen=True)
class SetupInput:
    code: str; name: str; close: float; open: float; high: float; low: float
    previous_close: float; market_cap: float; trading_value: float; volume_ratio: float
    ma5: float; ma10: float; ma20: float; ma60: float; ma120: float
    prior_52w_high_close: float; prior_close: float | None = None

@dataclass(frozen=True)
class SetupResult:
    key: str; name: str; passed: bool; reasons: tuple[str,...]; failures: tuple[str,...]

def _base(x: SetupInput) -> list[str]:
    f=[]
    if x.market_cap < MIN_MARKET_CAP: f.append('시가총액 1,000억 미만')
    if x.trading_value < MIN_TRADING_VALUE: f.append('거래대금 300억 미만')
    return f

def _aligned(x: SetupInput) -> bool: return x.ma5 > x.ma10 > x.ma20 > x.ma60 > x.ma120
def _upper_wick_pct(x: SetupInput) -> float:
    body_top=max(x.open,x.close); return max(0,x.high-body_top)/x.close*100
def _change_pct(x: SetupInput) -> float: return (x.close/x.previous_close-1)*100

def evaluate_setups(x: SetupInput) -> list[SetupResult]:
    base=_base(x); change=_change_pct(x); aligned=_aligned(x); wick=_upper_wick_pct(x)
    out=[]
    f=base.copy()
    if x.volume_ratio < 1.5: f.append('평균 대비 거래량 1.5배 미만')
    if change < 14.5: f.append('당일 +14.5% 장대양봉 미충족')
    if x.close <= x.open: f.append('양봉 마감 아님')
    out.append(SetupResult('A','메이저 수급 주도주',not f,('거래량 급증','당일 장대양봉 돌파'),tuple(f)))
    f=base.copy()
    if not aligned: f.append('120일 대세 정배열 미충족')
    if wick > 4.5: f.append(f'윗꼬리 {wick:.1f}% > 4.5%')
    if not (x.low <= x.ma10 and -1.5 <= change <= 1.0 and x.close >= x.ma10): f.append('10일선 터치·지지 반등 범위 미충족')
    out.append(SetupResult('B','10일선 급등 눌림목',not f,('120일 정배열','10일선 터치 후 지지'),tuple(f)))
    f=base.copy()
    if not aligned: f.append('120일 대세 정배열 미충족')
    if wick > 4.5: f.append(f'윗꼬리 {wick:.1f}% > 4.5%')
    if not (x.low <= x.ma20 and -2.0 <= change <= 1.5 and x.close >= x.ma20): f.append('20일선 터치·지지 반등 범위 미충족')
    out.append(SetupResult('C','20일선 정석 눌림목',not f,('120일 정배열','20일 생명선 지지'),tuple(f)))
    f=base.copy()
    if x.close <= x.prior_52w_high_close: f.append('240거래일 최고 종가 미돌파')
    if change < 1.5 or x.close <= x.open: f.append('+1.5% 이상 양봉 돌파 미충족')
    out.append(SetupResult('D','52주·역사적 신고가 돌파',not f,('240거래일 종가 신고가','양봉 돌파'),tuple(f)))
    f=base.copy()
    if not (x.close > x.ma20 and x.previous_close <= x.ma20): f.append('20일선 첫 상향 돌파 미충족')
    if change < 2.5: f.append('+2.5% 반등 미충족')
    if x.volume_ratio < 1.5: f.append('거래량 동반 미충족')
    out.append(SetupResult('E','바닥 턴어라운드',not f,('20일선 첫 상향 돌파','거래량 동반 반등'),tuple(f)))
    return out

@dataclass(frozen=True)
class ExitPlan:
    entry: float; stop: float; take_profit_3r: float; trail_stop_pct: float; time_stop_sessions: int
    def summary(self) -> dict[str,float|int]: return {'손절(1R)':self.stop,'3R 50% 익절':self.take_profit_3r,'잔여분 트레일링':self.trail_stop_pct,'타임스탑 거래일':self.time_stop_sessions}

def exit_plan(entry: float, risk_pct: float = .06) -> ExitPlan:
    return ExitPlan(entry,entry*(1-risk_pct),entry*(1+risk_pct*3),.05,40)

CORE_SECTOR_KEYWORDS: dict[str, tuple[str,...]] = {
    'AI·반도체':('HBM','AI메모리','반도체','GPU','파운드리'), '바이오':('바이오','제약','의료기기'),
    '방산':('방산','우주항공'), '로봇':('로봇','자동화'), '2차전지':('2차전지','배터리','양극재'),
    '원전':('원전','SMR'), '해운':('해운','조선','운임'), '에너지':('정유','유가','가스'),
    '자동차':('자동차','전장'), '금융':('은행','보험','증권'), '건설':('건설','인프라'),
    '통신':('통신','5G'), '게임·콘텐츠':('게임','웹툰','엔터'), '화학':('화학','소재'), '소비재':('화장품','유통','식품')
}

def sector_badges(text: str) -> list[str]:
    needle=text.lower(); return [sector for sector,words in CORE_SECTOR_KEYWORDS.items() if any(word.lower() in needle for word in words)]
