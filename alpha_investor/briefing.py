"""Morning-brief rendering and Telegram delivery.

Acquisition is intentionally separate from rendering: sources of US quotes, rates,
oil, KRX night futures and news must be licensed/official for commercial use.
"""
from __future__ import annotations
import json
from dataclasses import dataclass
from pathlib import Path
from .alerts import AlertService, TelegramChannel
from .models import AlertEvent
from .repository import Repository

@dataclass(frozen=True)
class BriefItem:
    label: str; value: str; change: str

@dataclass(frozen=True)
class MorningBrief:
    as_of: str; us_equities: list[BriefItem]; rates: list[BriefItem]
    energy: list[BriefItem]; korea_overnight: list[BriefItem]; headlines: list[str]

def load_brief(path: str | Path = 'data/overnight_briefing.json') -> MorningBrief | None:
    file=Path(path)
    if not file.exists(): return None
    body=json.loads(file.read_text(encoding='utf-8'))
    def items(key): return [BriefItem(**x) for x in body.get(key,[])]
    return MorningBrief(body['as_of'],items('us_equities'),items('rates'),items('energy'),items('korea_overnight'),body.get('headlines',[]))

def render_brief(brief: MorningBrief) -> str:
    def block(title,items): return title+'\n'+'\n'.join(f'• {x.label}: {x.value} ({x.change})' for x in items)
    parts=[f'☀️ 장전 브리핑 · {brief.as_of}',block('🇺🇸 미국 시장',brief.us_equities),block('🏦 국채·달러',brief.rates),block('🛢️ 원자재',brief.energy),block('🇰🇷 국내 야간·선물',brief.korea_overnight)]
    if brief.headlines: parts.append('📰 핵심 뉴스\n'+'\n'.join(f'• {x}' for x in brief.headlines[:5]))
    parts.append('※ 정보 제공용 요약입니다. 실제 장 시작 전 시세·공시·뉴스 원문을 재확인하세요.')
    return '\n\n'.join(parts)

def send_morning_brief() -> list[str]:
    brief=load_brief()
    if not brief: return []
    event=AlertEvent('morning_brief','MARKET',f'장전 브리핑 · {brief.as_of}',render_brief(brief),'info')
    return AlertService(Repository(),[TelegramChannel()]).dispatch(event)
