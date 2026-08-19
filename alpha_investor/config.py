from __future__ import annotations
import os
from dataclasses import dataclass
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

@dataclass(frozen=True)
class Settings:
    database_path: Path = Path(os.getenv("DATABASE_PATH", "data/alpha_investor.db"))
    telegram_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_chat_id: str = os.getenv("TELEGRAM_CHAT_ID", "")
    kakao_official_webhook_url: str = os.getenv("KAKAO_OFFICIAL_WEBHOOK_URL", "")
    market_open_hour: int = 9
    market_close_hour: int = 15
    kis_app_key: str = os.getenv("KIS_APP_KEY", "")
    kis_app_secret: str = os.getenv("KIS_APP_SECRET", "")
    kis_base_url: str = os.getenv("KIS_BASE_URL", "https://openapi.koreainvestment.com:9443")
    market_refresh_seconds: int = int(os.getenv("MARKET_REFRESH_SECONDS", "20"))
    data_mode: str = os.getenv("DATA_MODE", "auto").lower()

settings = Settings()
