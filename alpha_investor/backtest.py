from __future__ import annotations
import pandas as pd

def performance_metrics(trade_returns: list[float]) -> dict[str, float | int]:
    if not trade_returns: return {'trades': 0, 'win_rate': 0.0, 'profit_factor': 0.0, 'mdd': 0.0, 'expectancy': 0.0, 'max_consecutive_losses': 0}
    r = pd.Series(trade_returns, dtype=float); equity = (1+r).cumprod(); drawdown = equity/equity.cummax()-1
    profits, losses = r[r>0].sum(), abs(r[r<0].sum())
    run = best = 0
    for x in r:
        run = run + 1 if x < 0 else 0; best = max(best, run)
    return {'trades': len(r), 'win_rate': round((r>0).mean()*100, 1), 'profit_factor': round(profits/losses, 2) if losses else float('inf'), 'mdd': round(drawdown.min()*100, 2), 'expectancy': round(r.mean()*100, 2), 'max_consecutive_losses': best}
