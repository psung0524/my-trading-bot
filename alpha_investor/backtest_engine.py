"""Point-in-time daily-bar backtest with defined 6%/3R/trailing/time-stop exits."""
from __future__ import annotations
import pandas as pd
from .backtest import performance_metrics
REQUIRED_COLUMNS={'Open','High','Low','Close','Signal'}
def run_daily_backtest(frame:pd.DataFrame,risk_pct=.06,profit_r=3,trail_pct=.05,time_stop=40)->dict:
    missing=REQUIRED_COLUMNS-set(frame.columns)
    if missing: raise ValueError(f'필수 컬럼 누락: {sorted(missing)}')
    data=frame.copy().reset_index(drop=False); trades=[]; position=None
    for i,row in data.iterrows():
        if position is None:
            if i>0 and bool(data.iloc[i-1]['Signal']):
                entry=float(row['Open']); position={'entry':entry,'stop':entry*(1-risk_pct),'target':entry*(1+risk_pct*profit_r),'high':entry,'days':0,'half_taken':False}; continue
            continue
        position['days']+=1; position['high']=max(position['high'],float(row['High'])); exit_price=reason=None; size=1.0
        if float(row['Low'])<=position['stop']: exit_price=position['stop']; reason='stop'
        elif not position['half_taken'] and float(row['High'])>=position['target']:
            trades.append({'entry':position['entry'],'exit':position['target'],'size':.5,'return':risk_pct*profit_r,'reason':'3R_partial','days':position['days']}); position['half_taken']=True; position['stop']=position['entry']
        elif position['half_taken'] and float(row['Low'])<=position['high']*(1-trail_pct): exit_price=position['high']*(1-trail_pct); reason='trailing'; size=.5
        elif position['days']>=time_stop: exit_price=float(row['Close']); reason='time_stop'; size=.5 if position['half_taken'] else 1.0
        if exit_price is not None:
            trades.append({'entry':position['entry'],'exit':exit_price,'size':size,'return':(exit_price/position['entry']-1)*size,'reason':reason,'days':position['days']}); position=None
    returns=[x['return'] for x in trades]
    return {'metrics':performance_metrics(returns),'trades':pd.DataFrame(trades),'open_position':position is not None,'assumptions':'신호 다음 거래일 시가 진입, 수수료·세금·슬리피지 미포함; 실제 검증 시 반드시 반영 필요'}
