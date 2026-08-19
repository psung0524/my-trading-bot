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

settings = Settings()
