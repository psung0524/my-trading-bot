import requests
import json
from datetime import datetime

class TelegramNotifier:
    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.base_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"

    def send_message(self, text: str) -> bool:
        """텔레그램 메시지 전송"""
        try:
            payload = {
                "chat_id": self.chat_id,
                "text": text,
                "parse_mode": "Markdown"
            }
            res = requests.post(self.base_url, json=payload, timeout=5)
            return res.status_code == 200
        except Exception as e:
            print(f"텔레그램 전송 실패: {e}")
            return False

    def send_stop_loss_alert(self, ticker: str, current_price: int, buy_price: int, stop_price: int, loss_pct: float):
        """손절 경고 알림 템플릿"""
        msg = f"""🚨 *[원칙 준수 경고: 손절선 도달]*
━━━━━━━━━━━━━━━━━━
📌 *종목:* `{ticker}`
💰 *매수가:* {buy_price:,} 원
📉 *현재가:* {current_price:,} 원 (`{loss_pct:.2f}%`)
🛑 *설정 손절가:* {stop_price:,} 원

⚠️ *멘탈 코치의 한마디:*
"손실 확정은 실패가 아니라 다음 기회를 위한 자본 보호입니다. 지금 즉시 전량 시장가 매도하세요."
━━━━━━━━━━━━━━━━━━"""
        return self.send_message(msg)

    def send_time_stop_alert(self, ticker: str, holding_days: int, limit_days: int):
        """타임스탑 만료 경고 알림 템플릿"""
        msg = f"""⏱️ *[원칙 준수 경고: 타임스탑 만료]*
━━━━━━━━━━━━━━━━━━
📌 *종목:* `{ticker}`
⏳ *현재 보유일수:* `{holding_days}일` (제한: {limit_days}일)

⚠️ *멘탈 코치의 한마디:*
"기회비용을 갉아먹는 '존버'는 금지입니다. 3년 동안 묶이지 않으려면 지금 정리하고 새로운 기회를 찾으세요."
━━━━━━━━━━━━━━━━━━"""
        return self.send_message(msg)

# notifier.py 맨 아래 수정
if __name__ == "__main__":
    TOKEN = "8683655215:AAGF9pEphYT6c-bMWVeWuuxTMuF0MkUTnNg"
    CHAT_ID = "5824132525"
    
    bot = TelegramNotifier(TOKEN, CHAT_ID)
    
    print("⏳ 텔레그램으로 테스트 메시지 발송 중...")
    success = bot.send_stop_loss_alert(
        ticker="SK하이닉스",
        current_price=645000,
        buy_price=690000,
        stop_price=650000,
        loss_pct=-6.52
    )
    
    if success:
        print("✅ 성공! 스마트폰 텔레그램 알림을 확인하세요.")
    else:
        print("❌ 실패! 토큰 또는 Chat ID를 다시 확인하세요.")
    pass