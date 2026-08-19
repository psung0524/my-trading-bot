"""No-key Korean market fallback.

FinanceDataReader and pykrx are community data readers/crawlers.  They are useful
for development and end-of-day research but are not a licensed real-time feed.
Every returned quote is labelled with its source and timestamp.  Production
services should use a contracted exchange/broker feed instead.
"""
from __future__ import annotations
from datetime import date, timedelta
from .market_intelligence import IndexQuote

class FreeDataUnavailable(RuntimeError): pass

def _number(row, *keys) -> float:
    for key in keys:
        if key in row: return float(row[key])
    raise KeyError(keys)

class FreeKoreaProvider:
    def _fdr(self):
        try:
            import FinanceDataReader as fdr
            return fdr
        except ImportError as exc: raise FreeDataUnavailable('FinanceDataReader를 설치하세요: pip install -r requirements.txt') from exc
    def daily_indices(self) -> list[IndexQuote]:
        fdr=self._fdr(); start=(date.today()-timedelta(days=20)).isoformat(); output=[]
        for name,symbol in [('KOSPI','KS11'),('KOSDAQ','KQ11')]:
            frame=fdr.DataReader(symbol,start)
            if len(frame)<2: raise FreeDataUnavailable(f'{name} 일봉 데이터가 충분하지 않습니다.')
            last,previous=frame.iloc[-1],frame.iloc[-2]; value=_number(last,'Close','close'); prior=_number(previous,'Close','close')
            stamp=str(frame.index[-1])[:10]
            output.append(IndexQuote(name,value,value-prior,(value/prior-1)*100,stamp,'FinanceDataReader (일봉·비실시간)'))
        return output
