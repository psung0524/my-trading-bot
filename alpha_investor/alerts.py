from __future__ import annotations
from abc import ABC, abstractmethod
import hashlib, logging, requests
from .config import settings
from .models import AlertEvent
from .repository import Repository
log=logging.getLogger(__name__)
class AlertChannel(ABC):
    name: str
    @abstractmethod
    def send(self,event:AlertEvent)->bool: ...
class TelegramChannel(AlertChannel):
    name='telegram'
    def send(self,event):
        if not settings.telegram_token or not settings.telegram_chat_id: raise RuntimeError('Telegram credentials missing')
        r=requests.post(f'https://api.telegram.org/bot{settings.telegram_token}/sendMessage',json={'chat_id':settings.telegram_chat_id,'text':f'[{event.severity.upper()}] {event.title}\n{event.body}'},timeout=10); r.raise_for_status(); return True
class OfficialKakaoChannel(AlertChannel):
    name='kakao_official'
    def send(self,event):
        if not settings.kakao_official_webhook_url: raise RuntimeError('Official Kakao endpoint not configured')
        r=requests.post(settings.kakao_official_webhook_url,json={'title':event.title,'body':event.body,'event_type':event.event_type},timeout=10); r.raise_for_status(); return True
class AlertService:
    """Durable outbox: enqueue first, retry failures, dedupe per event/channel/minute."""
    def __init__(self,repository:Repository,channels:list[AlertChannel]): self.repo,self.channels=repository,{c.name:c for c in channels}
    def dispatch(self,event:AlertEvent):
        bucket=event.occurred_at.strftime('%Y%m%d%H%M'); queued=[]
        for channel in self.channels:
            key=hashlib.sha256(f'{channel}|{event.event_type}|{event.symbol}|{bucket}'.encode()).hexdigest()
            if self.repo.enqueue_alert(key,channel,event): queued.append(channel)
        return self.deliver_pending(queued)
    def deliver_pending(self,only_channels=None):
        delivered=[]
        for name,channel in self.channels.items():
            if only_channels is not None and name not in only_channels: continue
            for alert_id,event_type,symbol,title,body,severity,attempts in self.repo.pending_alerts(name):
                try:
                    channel.send(AlertEvent(event_type,symbol,title,body,severity)); self.repo.mark_alert_delivered(alert_id); delivered.append(name)
                except (requests.RequestException,RuntimeError) as exc:
                    log.warning('alert delivery failed (%s): %s',name,exc); self.repo.mark_alert_failed(alert_id,exc)
        return delivered
