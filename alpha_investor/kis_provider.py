"""Official KIS REST adapter for current domestic index quotes.

It intentionally performs read-only quote calls. Credentials are read from the
environment, never the UI or repository.
"""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
import requests
from .config import settings
from .market_intelligence import IndexQuote

class KisConfigurationError(RuntimeError): pass

class KisMarketProvider:
    _token: str | None = None
    _expires_at: datetime | None = None
    def __init__(self):
        if not settings.kis_app_key or not settings.kis_app_secret:
            raise KisConfigurationError('KIS_APP_KEY and KIS_APP_SECRET are required for live quotes.')
        self.base=settings.kis_base_url.rstrip('/')
    def _access_token(self) -> str:
        now=datetime.now(timezone.utc)
        if self._token and self._expires_at and now < self._expires_at: return self._token
        r=requests.post(f'{self.base}/oauth2/tokenP',json={'grant_type':'client_credentials','appkey':settings.kis_app_key,'appsecret':settings.kis_app_secret},timeout=10)
        r.raise_for_status(); body=r.json(); self._token=body['access_token']; self._expires_at=now+timedelta(seconds=max(int(body.get('expires_in',3600))-60,60)); return self._token
    def index_quote(self, name: str, index_code: str) -> IndexQuote:
        headers={'authorization':f'Bearer {self._access_token()}','appkey':settings.kis_app_key,'appsecret':settings.kis_app_secret,'tr_id':'FHPUP02100000'}
        params={'FID_COND_MRKT_DIV_CODE':'U','FID_INPUT_ISCD':index_code}
        r=requests.get(f'{self.base}/uapi/domestic-stock/v1/quotations/inquire-index-price',headers=headers,params=params,timeout=10); r.raise_for_status(); body=r.json()
        if body.get('rt_cd') != '0': raise RuntimeError(body.get('msg1','KIS index quote error'))
        out=body['output']; return IndexQuote(name,float(out['bstp_nmix_prpr']),float(out['bstp_nmix_prdy_vrss']),float(out['bstp_nmix_prdy_ctrt']),datetime.now().strftime('%H:%M:%S'),'KIS Open API')
    def major_indices(self) -> list[IndexQuote]:
        return [self.index_quote('KOSPI','0001'),self.index_quote('KOSDAQ','1001')]
