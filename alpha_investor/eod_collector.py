"""Key-free end-of-day collection for research, never advertised as intraday real time."""
from __future__ import annotations
from datetime import datetime
from .repository import Repository
from .strategy_engine import sector_badges

def collect_krx_eod(repository: Repository, max_rows: int = 300) -> int:
    """Persist a health audit. Extend this function with a licensed feed for production."""
    try:
        from pykrx import stock
    except ImportError as exc:
        repository.record_health('pykrx','KRX EOD','',0,'error','pykrx not installed')
        raise RuntimeError('pykrx is not installed') from exc
    today=datetime.now().strftime('%Y%m%d')
    rows=0
    try:
        for market in ('KOSPI','KOSDAQ'):
            frame=stock.get_market_ohlcv_by_ticker(today,market=market)
            if frame.empty: continue
            amount='거래대금' if '거래대금' in frame else frame.columns[-1]
            for code,row in frame.nlargest(max_rows,amount).iterrows():
                # Theme labels are provisional until user review; avoid presenting them as a fact.
                name=stock.get_market_ticker_name(code); badges=sector_badges(name)
                repository.save_theme_mapping(str(code),badges[0] if badges else '미분류','',f'자동 수집 초안 ({market})')
                rows+=1
        repository.record_health('pykrx','KRX EOD',today,rows,'ok','장마감 연구용 수집; 비실시간')
        return rows
    except Exception as exc:
        repository.record_health('pykrx','KRX EOD',today,rows,'error',str(exc))
        raise
