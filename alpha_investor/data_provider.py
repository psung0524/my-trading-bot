"""Replace SampleProvider with broker/exchange/DART/news adapters without changing UI logic."""
from __future__ import annotations
import pandas as pd
from .models import StockSnapshot

class SampleProvider:
    def snapshots(self):
        return [
            StockSnapshot('005930','삼성전자',78000,2.1,2.8,1.9,77500,76900,75400,72000,68000,-1.0,'반도체',['신고가','거래량']),
            StockSnapshot('000660','SK하이닉스',231000,4.2,3.7,2.4,228000,224000,216000,195000,168000,0.3,'반도체',['돌파','정배열','거래량']),
            StockSnapshot('012450','한화에어로스페이스',815000,-0.8,1.1,1.3,807000,800000,781000,720000,620000,-4.0,'방산',['눌림목']),
        ]
    def index_history(self):
        closes=[2500+i*4+(i%5-2)*9 for i in range(80)]
        return pd.DataFrame({'close': closes})
