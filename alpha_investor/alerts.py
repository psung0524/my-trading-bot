from __future__ import annotations
from abc import ABC, abstractmethod
from datetime import datetime
import hashlib, logging, requests
from .config import settings
from .models import AlertEvent
from .repository import Repository
log = logging.getLogger(__name__)

class AlertChannel(ABC):
    name: str
    @abstractmethod
    def send(self, event: AlertEvent) -> bool: ...
class TelegramChannel(AlertChannel):
    name='telegram'
    def send(self, event):
        if not settings.telegram_token or not settings.telegram_chat_id: log.warning('Telegram credentials missing'); return False
        response = requests.post(f'https://api.telegram.org/bot{settings.telegram_token}/sendMessage', json={'chat_id': settings.telegram_chat_id, 'text': f'[{event.severity.upper()}] {event.title}\n{event.body}'}, timeout=10)
        response.raise_for_status(); return True
class OfficialKakaoChannel(AlertChannel):
    """Only a customer-owned official Business/Channel gateway. No personal-chat automation."""
    name='kakao_official'
    def send(self,event):
        if not settings.kakao_official_webhook_url: log.info('Official Kakao endpoint not configured'); return False
        r=requests.post(settings.kakao_official_webhook_url,json={'title':event.title,'body':event.body,'event_type':event.event_type},timeout=10); r.raise_for_status(); return True
class AlertService:
    def __init__(self, repository: Repository, channels: list[AlertChannel]): self.repo,self.channels=repository,channels
    def dispatch(self,event: AlertEvent):
        bucket=event.occurred_at.strftime('%Y%m%d%H%M')
        delivered=[]
        for channel in self.channels:
            key=hashlib.sha256(f'{channel.name}|{event.event_type}|{event.symbol}|{bucket}'.encode()).hexdigest()
            if not self.repo.reserve_alert(key,channel.name,event.event_type): continue
            try:
                if channel.send(event): delivered.append(channel.name)
            except requests.RequestException: log.exception('alert delivery failed: %s',channel.name)
        return delivered
