from __future__ import annotations
from .models import AlertEvent

def position_events(row, current_price: float):
    code,name,entry,stop,target3,*_ = row; events=[]
    if not entry or not stop: return events
    risk=entry-stop
    if current_price <= stop: events.append(AlertEvent('stop_hit',code,f'손절 기준 이탈: {name}',f'현재 {current_price:,.0f} / 손절 {stop:,.0f}','critical'))
    elif current_price >= entry+risk*3: events.append(AlertEvent('target_3r',code,f'3R 도달: {name}',f'현재 {current_price:,.0f}, 계획 재검토 필요','info'))
    elif current_price >= entry+risk: events.append(AlertEvent('target_1r',code,f'1R 도달: {name}',f'현재 {current_price:,.0f}, 손절 상향 여부 검토','info'))
    return events
