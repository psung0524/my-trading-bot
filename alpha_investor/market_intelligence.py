"""Provider-neutral market leadership aggregation.

The collector must supply timestamped, licensed market rows.  Theme membership is
deliberately explicit: an unexplained keyword grouping must never be presented as
market fact.
"""
from __future__ import annotations
from dataclasses import dataclass
from collections import defaultdict
from typing import Iterable

@dataclass(frozen=True)
class IndexQuote:
    name: str
    value: float
    change: float
    change_pct: float
    as_of: str
    source: str

@dataclass(frozen=True)
class MarketRow:
    code: str; name: str; sector: str; theme: str
    price: float; change_pct: float; trading_value: float
    foreign_net_buy: float | None = None; institution_net_buy: float | None = None
    program_net_buy: float | None = None; high_52w_distance: float | None = None

def leader_groups(rows: Iterable[MarketRow], key: str, minimum_members: int = 2) -> list[dict]:
    groups: dict[str, list[MarketRow]] = defaultdict(list)
    for row in rows:
        name=getattr(row,key)
        if name: groups[name].append(row)
    output=[]
    for name, items in groups.items():
        value=sum(x.trading_value for x in items)
        weighted_return=(sum(x.change_pct*x.trading_value for x in items)/value) if value else 0
        foreign=sum(x.foreign_net_buy or 0 for x in items); institution=sum(x.institution_net_buy or 0 for x in items); program=sum(x.program_net_buy or 0 for x in items)
        # A group is ranked by liquidity + performance, then flow as a transparent tie-breaker.
        leadership=(weighted_return*10)+(min(value/1_000_000_000,100)*.25)+(max(foreign+institution+program,0)/1_000_000_000*.1)
        output.append({"name":name,"members":len(items),"return_pct":round(weighted_return,2),"trading_value":value,"foreign_net_buy":foreign,"institution_net_buy":institution,"program_net_buy":program,"leadership":round(leadership,2),"stocks":sorted(items,key=lambda x:x.trading_value,reverse=True)})
    return sorted([x for x in output if x['members']>=minimum_members],key=lambda x:x['leadership'],reverse=True)

def new_high_candidates(rows: Iterable[MarketRow], maximum_distance: float = 3.0) -> list[MarketRow]:
    return sorted([x for x in rows if x.high_52w_distance is not None and x.high_52w_distance >= -maximum_distance],key=lambda x:(x.change_pct,x.trading_value),reverse=True)

def sample_market_rows() -> list[MarketRow]:
    # Clearly demo-only rows; replace with a licensed collector before publication.
    return [
        MarketRow('005930','삼성전자','반도체','HBM·AI메모리',78000,2.1,1.42e12,84e9,31e9,14e9,-1.0),
        MarketRow('000660','SK하이닉스','반도체','HBM·AI메모리',231000,4.2,1.17e12,119e9,28e9,21e9,0.3),
        MarketRow('042700','한미반도체','반도체','HBM·AI메모리',125000,5.8,0.18e12,9e9,4e9,2e9,-0.6),
        MarketRow('012450','한화에어로스페이스','기계·방산','방산 수출',815000,-0.8,0.36e12,12e9,8e9,1e9,-4.0),
        MarketRow('047810','한국항공우주','기계·방산','방산 수출',97000,3.6,0.10e12,7e9,2e9,1e9,-1.7),
        MarketRow('096770','SK이노베이션','에너지','정유·에너지',115000,2.4,0.12e12,-2e9,11e9,1e9,-2.1),
        MarketRow('010950','S-Oil','에너지','정유·에너지',68000,1.8,0.09e12,3e9,5e9,1e9,-1.5),
    ]
