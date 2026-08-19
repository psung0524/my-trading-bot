from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

@dataclass
class StockSnapshot:
    code: str; name: str; price: float; change_pct: float
    volume_ratio: float; turnover_ratio: float
    ma5: float; ma10: float; ma20: float; ma60: float; ma120: float
    high_52w_distance: float; theme: str = "미분류"; strategies: list[str] = field(default_factory=list)
    foreign_flow: float | None = None; institution_flow: float | None = None

@dataclass
class ScoreResult:
    total: int; grade: str; reasons: list[str]; components: dict[str, int]

@dataclass
class TradePlan:
    entry: float; stop: float; r1: float; r2: float; r3: float
    risk_pct: float; entry_conditions: list[str]; invalidations: list[str]

@dataclass
class AlertEvent:
    event_type: str; symbol: str; title: str; body: str
    severity: str = "info"; occurred_at: datetime = field(default_factory=datetime.now)
    payload: dict[str, Any] = field(default_factory=dict)
