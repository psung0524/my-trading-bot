import time
import json
import os
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from dotenv import load_dotenv
from notifier import TelegramNotifier
from screener import NaverStockScreener

WATCHLIST_FILE = "watchlist.json"
CONFIG_FILE = Path(__file__).parent / "config.json"
ENV_FILE = Path(__file__).parent / ".env"

def fetch_current_price(code: str) -> int:
    url = f"https://finance.naver.com/item/main.naver?code={code}"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        res = requests.get(url, headers=headers, timeout=3)
        soup = BeautifulSoup(res.text, "html.parser")
        p_tag = soup.select_one("p.no_today span.blind")
        if p_tag:
            return int(p_tag.text.replace(",", "").strip())
    except Exception:
        pass
    return 0

def run_watcher_loop(bot_token: str, chat_id: str):
    notifier = TelegramNotifier(bot_token, chat_id)
    print("📡 [실시간 감시 & 4대 타임라인 자동 브리핑 가디언 활성화]")
    warned_stocks = set()
    stopped_stocks = set()
    sent_briefings = set()

    while True:
        now = datetime.now()
        time_str = now.strftime("%H:%M")
        date_str = now.strftime("%Y-%m-%d")

        # ⏰ 4대 타임라인 자동 브리핑 스케줄러 (평일 장 운영 시간)
        if bot_token and chat_id and now.weekday() < 5:
            # 1. 08:00 글로벌 매크로
            if time_str == "08:00" and f"{date_str}_0800" not in sent_briefings:
                msg = NaverStockScreener.generate_0800_global_briefing()
                notifier.send_message(msg)
                sent_briefings.add(f"{date_str}_0800")
                print("📢 [08:00 글로벌 매크로 브리핑 발송 완료]")

            # 2. 08:50 장전 프리마켓/NXT 테마 & 골든픽
            elif time_str == "08:50" and f"{date_str}_0850" not in sent_briefings:
                msg = NaverStockScreener.generate_0850_nxt_briefing()
                notifier.send_message(msg)
                sent_briefings.add(f"{date_str}_0850")
                print("📢 [08:50 장전 프리마켓/NXT 브리핑 발송 완료]")

            # 3. 09:30 장초반 1차 주도주 & 자금 쏠림
            elif time_str == "09:30" and f"{date_str}_0930" not in sent_briefings:
                msg = NaverStockScreener.generate_intraday_leader_briefing("09:30")
                notifier.send_message(msg)
                sent_briefings.add(f"{date_str}_0930")
                print("📢 [09:30 장초반 주도섹터 브리핑 발송 완료]")

            # 4. 10:00 장중 2차 확정 주도주 & 자금 집중
            elif time_str == "10:00" and f"{date_str}_1000" not in sent_briefings:
                msg = NaverStockScreener.generate_intraday_leader_briefing("10:00")
                notifier.send_message(msg)
                sent_briefings.add(f"{date_str}_1000")
                print("📢 [10:00 장중 확정 주도주 브리핑 발송 완료]")

        # 🛑 실시간 보유 종목 손절선 감시
        if os.path.exists(WATCHLIST_FILE):
            try:
                with open(WATCHLIST_FILE, "r", encoding="utf-8") as f:
                    watchlist = json.load(f)
            except Exception:
                watchlist = []

            updated = False
            for item in watchlist:
                code = item["code"]
                name = item["name"]
                buy_price = item["buy_price"]
                stop_price = item["stop_price"]

                curr_price = fetch_current_price(code)
                if curr_price <= 0:
                    continue

                pnl_pct = round(((curr_price - buy_price) / buy_price) * 100, 2)
                item["current_price"] = curr_price
                item["pnl_pct"] = pnl_pct
                updated = True

                # 강제 손절
                if curr_price <= stop_price and code not in stopped_stocks:
                    stopped_stocks.add(code)
                    msg = (
                        f"🚨 *[강제 손절 발동] 원칙 매도 알림*\n\n"
                        f"• 종목: *{name}* (`{code}`)\n"
                        f"• 현재가: `{curr_price:,}원` (*{pnl_pct}%*)\n"
                        f"• 설정 손절가: `{stop_price:,}원` 도달!\n\n"
                        f"⚠️ *뇌동 매매를 멈추고 기계적으로 손절 매도하세요.*"
                    )
                    notifier.send_message(msg)

                # 손절 임박 경고
                warning_price = stop_price * 1.015
                if stop_price < curr_price <= warning_price and code not in warned_stocks and code not in stopped_stocks:
                    warned_stocks.add(code)
                    msg = (
                        f"⚠️ *[손절 임박 주의] 리스크 경고*\n\n"
                        f"• 종목: *{name}* (`{code}`)\n"
                        f"• 현재가: `{curr_price:,}원` (*{pnl_pct}%*)\n"
                        f"• 손절선: `{stop_price:,}원`까지 단 *{round((curr_price-stop_price)/stop_price*100, 1)}%* 남음!\n\n"
                        f"💡 *반등 실패 시 미련 없이 정리할 준비를 하세요.*"
                    )
                    notifier.send_message(msg)

            if updated:
                with open(WATCHLIST_FILE, "w", encoding="utf-8") as f:
                    json.dump(watchlist, f, ensure_ascii=False, indent=2)

        time.sleep(3)

if __name__ == "__main__":
    load_dotenv(dotenv_path=ENV_FILE, override=True)
    
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "")
    
    # config.json 우선 로드
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                token = cfg.get("tg_token") or token
                chat_id = cfg.get("tg_chat_id") or chat_id
        except Exception:
            pass

    if not token or not chat_id:
        print("⚠️ 텔레그램 토큰 또는 Chat ID가 설정되지 않았습니다. app.py 화면에서 입력 후 [영구 저장]을 눌러주세요.")
    
    run_watcher_loop(token, chat_id)