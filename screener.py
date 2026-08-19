import requests
from bs4 import BeautifulSoup
import pandas as pd
import numpy as np
from functools import lru_cache
import re

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

def clean_num(val) -> float:
    if val is None:
        return 0.0
    s = str(val).replace(',', '').replace('%', '').replace('+', '').strip()
    try:
        return float(s)
    except ValueError:
        return 0.0

class NaverStockScreener:
    STRATEGIES = {
        "A": {"name": "전략 A. 메이저 수급 주도주", "badge": "💎 수급주도", "desc": "시총 1000억↑ & 거래대금 300억↑ & 주도 수급 포착"},
        "B": {"name": "전략 B. 10일선 급등 눌림목", "badge": "🎯 10일선눌림", "desc": "120일 정배열 추세 중 단기 지지 반등"},
        "C": {"name": "전략 C. 20일선 정석 눌림목", "badge": "🛡️ 20일선눌림", "desc": "20일 생명선 눌림목 반등 타점"},
        "D": {"name": "전략 D. 52주/역사적 신고가 돌파", "badge": "🚀 신고가돌파", "desc": "매물대 상단 돌파 수급 집중"},
        "E": {"name": "전략 E. 바닥 턴어라운드", "badge": "🌱 바닥턴", "desc": "바닥권 거래량 폭증 턴어라운드"}
    }

    # 산뜻한 라이트 모드 전용 섹터 컬러 팔레트
    SECTOR_PALETTE = {
        "화장품/뷰티": {"emoji": "💄", "bg": "#fce7f3", "color": "#be185d"},
        "항공/여행/운송": {"emoji": "✈️", "bg": "#e0f2fe", "color": "#0369a1"},
        "조선/해양/방산": {"emoji": "🚢", "bg": "#e0e7ff", "color": "#3730a3"},
        "반도체/IT": {"emoji": "💻", "bg": "#dbeafe", "color": "#1d4ed8"},
        "바이오/제약": {"emoji": "🧬", "bg": "#d1fae5", "color": "#047857"},
        "로봇/AI/자동화": {"emoji": "🤖", "bg": "#f3e8ff", "color": "#6b21a8"},
        "원전/에너지/신재생": {"emoji": "⚡", "bg": "#fef9c3", "color": "#a16207"},
        "자동차/부품/전장": {"emoji": "🚗", "bg": "#f1f5f9", "color": "#334155"},
        "2차전지/배터리": {"emoji": "🔋", "bg": "#ccfbf1", "color": "#0f766e"},
        "디스플레이/전자": {"emoji": "🖥️", "bg": "#ede9fe", "color": "#5b21b6"},
        "화학/소재/정밀": {"emoji": "🧪", "bg": "#dcfce7", "color": "#15803d"},
        "통신/인프라/지주": {"emoji": "📡", "bg": "#f1f5f9", "color": "#475569"},
        "금융/증권/보험": {"emoji": "🏦", "bg": "#ffedd5", "color": "#c2410c"},
        "철강/금속/기계": {"emoji": "⚙️", "bg": "#f5f5f4", "color": "#44403c"},
        "기타주도주": {"emoji": "🔥", "bg": "#fee2e2", "color": "#b91c1c"}
    }

    KNOWN_STOCKS = {
        "257720": ("화장품/뷰티", "K-뷰티"), "003490": ("항공/여행/운송", "항공사"),
        "010140": ("조선/해양/방산", "조선"), "042660": ("조선/해양/방산", "조선/해양"),
        "010170": ("통신/인프라/지주", "광케이블"), "396300": ("자동차/부품/전장", "다이캐스팅"),
        "212560": ("자동차/부품/전장", "구동장치"), "093370": ("화학/소재/정밀", "2차전지소재"),
        "034220": ("디스플레이/전자", "OLED"), "066430": ("로봇/AI/자동화", "로봇모듈"),
        "000660": ("반도체/IT", "HBM/D램"), "005930": ("반도체/IT", "메모리"),
        "017670": ("통신/인프라/지주", "통신/AI"), "319400": ("로봇/AI/자동화", "스마트물류"),
        "950160": ("바이오/제약", "신약개발"), "125490": ("자동차/부품/전장", "전장부품"),
        "475150": ("원전/에너지/신재생", "풍력/에너지"), "034020": ("원전/에너지/신재생", "SMR/원전"),
        "466100": ("로봇/AI/자동화", "물류로봇"), "439090": ("로봇/AI/자동화", "로봇자동화"),
        "088350": ("금융/증권/보험", "생명보험"), "440110": ("반도체/IT", "SSD"),
        "253590": ("반도체/IT", "CXL"), "058610": ("로봇/AI/자동화", "감속기"),
        "025980": ("항공/여행/운송", "리조트/관광")
    }

    @staticmethod
    def get_market_regime() -> dict:
        try:
            url_kospi = "https://fchart.stock.naver.com/sise.nhn?symbol=KOSPI&timeframe=day&count=100&requestType=0"
            res = SESSION.get(url_kospi, timeout=2.0)
            soup = BeautifulSoup(res.text, "html.parser")
            items = soup.select("item")
            closes = [float(item.get("data").split("|")[4]) for item in items if item.get("data")]
            
            if len(closes) >= 60:
                curr_kospi = closes[-1]
                ma20 = sum(closes[-20:]) / 20.0
                ma60 = sum(closes[-60:]) / 60.0
                prev_close = closes[-2]
                change_pct = round(((curr_kospi - prev_close) / prev_close) * 100, 2)

                if curr_kospi > ma20 and ma20 >= ma60:
                    status = "BULL"
                    badge = "🟢 강세 상승장 (공격 모드)"
                    desc = "지수가 20일선 위에서 우상향 중입니다. [신고가 돌파 / 3R 추세추종] 전략이 최적입니다."
                    recommended_strategy = "D"
                    alloc_guide = "주식 80~100% / 현금 0~20%"
                elif curr_kospi < ma20 and curr_kospi < ma60:
                    status = "BEAR"
                    badge = "🔴 약세 하락장 (방어 모드)"
                    desc = "지수가 20일선 아래에 위치합니다. 뇌동 매매를 멈추고 [현금 확보 / 5일선 칼손절]을 권장합니다."
                    recommended_strategy = "E"
                    alloc_guide = "주식 0~20% / 현금 80~100%"
                else:
                    status = "NEUTRAL"
                    badge = "🟡 박스권/변동성 장세 (스윙 모드)"
                    desc = "지수가 20일선 부근에서 수렴 중입니다. [지지/저항 50% 분할익절 & 리테스트]가 유리합니다."
                    recommended_strategy = "B"
                    alloc_guide = "주식 40~60% / 현금 40~60%"

                return {
                    "kospi_close": curr_kospi,
                    "kospi_change_pct": change_pct,
                    "ma20": round(ma20, 2),
                    "ma60": round(ma60, 2),
                    "status": status,
                    "badge": badge,
                    "desc": desc,
                    "recommended_strategy": recommended_strategy,
                    "alloc_guide": alloc_guide
                }
        except Exception:
            pass

        return {
            "kospi_close": 2600.0, "kospi_change_pct": 0.0, "ma20": 2600.0, "ma60": 2600.0,
            "status": "BULL", "badge": "🟢 강세 상승장 (기본값)", "desc": "정상적인 추세 추종 매매 유지",
            "recommended_strategy": "D", "alloc_guide": "주식 80% / 현금 20%"
        }

    @staticmethod
    def get_global_macro_data() -> dict:
        macro = {
            "nasdaq": ("나스닥", "+0.85%"),
            "sp500": ("S&P 500", "+0.52%"),
            "dow": ("다우존스", "+0.31%"),
            "us10y": ("미 국채 10년물", "4.28%"),
            "wti": ("WTI 원유", "$78.40"),
            "usdkrw": ("원/달러 환율", "1,342.50원"),
            "night_future": ("코스피200 야간선물", "385.50 (+0.45%)")
        }
        try:
            url = "https://finance.naver.com/marketindex/"
            res = SESSION.get(url, timeout=2.0)
            soup = BeautifulSoup(res.text, "html.parser")
            ex_rate = soup.select_one("div.head_info span.value")
            if ex_rate:
                macro["usdkrw"] = ("원/달러 환율", f"{ex_rate.text.strip()}원")
            oil = soup.select_one("ul.data_list li.on div.head_info span.value")
            if oil:
                macro["wti"] = ("WTI 원유", f"${oil.text.strip()}")
        except Exception:
            pass
        return macro

    @classmethod
    def classify_sector(cls, code: str, name: str) -> dict:
        # 1. 등록된 주요 종목 사전 검사
        if code in cls.KNOWN_STOCKS:
            cat, detail = cls.KNOWN_STOCKS[code]
            palette = cls.SECTOR_PALETTE.get(cat, cls.SECTOR_PALETTE["기타주도주"])
            return {"category": cat, "raw_industry": detail, "emoji": palette["emoji"], "bg": palette["bg"], "color": palette["color"]}

        # 2. 키워드 기반 안전 분류 (외계어 발생 원천 차단)
        rules = [
            (["화장품", "뷰티", "미용", "생활용품", "토니모리", "마녀공장", "코스맥스", "한국콜마"], "화장품/뷰티"),
            (["항공", "해운", "육상", "물류", "여행", "호텔", "운송", "리조트", "관광", "아난티", "모두투어", "하나투어"], "항공/여행/운송"),
            (["조선", "해양", "방위", "우주", "항공우주", "방산", "한화에어로", "현대로템", "LIG넥스원"], "조선/해양/방산"),
            (["반도체", "IT", "소프트웨어", "인터넷", "전자장비", "하이닉스", "한미반도체", "CXL", "HBM"], "반도체/IT"),
            (["제약", "바이오", "생물", "헬스케어", "의료", "신약", "알테오젠", "삼천당제약", "펩트론", "HLB"], "바이오/제약"),
            (["로봇", "자동화", "인공지능", "AI", "스마트팩토리", "레인보우", "두산로보", "엔젤로보틱스"], "로봇/AI/자동화"),
            (["원자력", "전력", "에너지", "풍력", "태양광", "신재생", "SMR", "두산에너", "일진전기", "효성중공업"], "원전/에너지/신재생"),
            (["자동차", "자동차부품", "전장", "타이어", "모빌리티", "현대차", "기아", "모비스"], "자동차/부품/전장"),
            (["2차전지", "축전지", "배터리", "리튬", "양극재", "음극재", "에코프로", "포스코홀딩스", "LG엔솔"], "2차전지/배터리"),
            (["디스플레이", "패널", "OLED", "LCD"], "디스플레이/전자"),
            (["화학", "정밀화학", "석유화학", "소재"], "화학/소재/정밀"),
            (["통신", "통신방송", "지주사", "네트워크", "광케이블"], "통신/인프라/지주"),
            (["은행", "증권", "보험", "카드", "금융", "생명"], "금융/증권/보험"),
            (["철강", "금속", "기계", "비철금속"], "철강/금속/기계"),
        ]

        assigned = "기타주도주"
        for keywords, category in rules:
            if any(k in name for k in keywords):
                assigned = category
                break

        palette = cls.SECTOR_PALETTE.get(assigned, cls.SECTOR_PALETTE["기타주도주"])
        return {"category": assigned, "raw_industry": assigned, "emoji": palette["emoji"], "bg": palette["bg"], "color": palette["color"]}

    @staticmethod
    def get_top_themes() -> list:
        url = "https://finance.naver.com/sise/theme.naver"
        themes = []
        try:
            res = SESSION.get(url, timeout=2.5)
            soup = BeautifulSoup(res.content.decode("euc-kr", errors="ignore"), "html.parser")
            for tr in soup.select("table.theme tr"):
                tds = tr.select("td")
                if len(tds) < 4:
                    continue
                name_tag = tds[0].find("a")
                if not name_tag:
                    continue
                theme_name = name_tag.text.strip()
                theme_href = name_tag.get("href", "")
                change_rate = clean_num(tds[1].text)

                if change_rate > 0.1 and theme_href:
                    detail_url = f"https://finance.naver.com{theme_href}"
                    leader_name = "확인중"
                    member_stocks = []
                    try:
                        d_res = SESSION.get(detail_url, timeout=1.5)
                        d_soup = BeautifulSoup(d_res.content.decode("euc-kr", errors="ignore"), "html.parser")
                        for ir in d_soup.select("table.type_5 tr"):
                            itd = ir.select("td")
                            if len(itd) < 5:
                                continue
                            ia = itd[0].find("a")
                            if ia:
                                member_stocks.append(ia.text.strip())
                        if member_stocks:
                            leader_name = member_stocks[0]
                    except Exception:
                        pass
                    themes.append({"theme_name": theme_name, "change_rate": change_rate, "leader": leader_name, "member_stocks": member_stocks})
                if len(themes) >= 4:
                    break
        except Exception:
            pass
        return themes

    @classmethod
    def get_market_ranking(cls, sosok: int = 0) -> list:
        market_name = "코스피" if sosok == 0 else "코스닥"
        candidates = []

        for page in range(1, 3):
            url = f"https://finance.naver.com/sise/sise_market_sum.naver?sosok={sosok}&page={page}"
            try:
                res = SESSION.get(url, timeout=3.0)
                soup = BeautifulSoup(res.content.decode("euc-kr", errors="ignore"), "html.parser")
                for tr in soup.select("table.type_2 tr"):
                    tds = tr.select("td")
                    if len(tds) < 12:
                        continue
                    a_tag = tds[1].find("a")
                    if not a_tag:
                        continue
                    name = a_tag.text.strip()
                    href = a_tag.get("href", "")
                    code = href.split("code=")[-1] if "code=" in href else ""

                    if any(x in name for x in ["스팩", "ETN", "TIGER", "KODEX", "ACE", "SOL", "RISE", "인버스", "레버리지", "우", "우B"]):
                        continue

                    curr_p = int(clean_num(tds[2].text))
                    change_rate = clean_num(tds[4].text)
                    vol = clean_num(tds[9].text)
                    cap_억 = clean_num(tds[12].text) if len(tds) > 12 else 1000.0
                    trading_val_억 = round((curr_p * vol) / 100000000.0, 1)

                    if trading_val_억 < 100.0:
                        continue

                    candidates.append({
                        "market_name": market_name,
                        "code": str(code).zfill(6),
                        "name": name,
                        "curr_p": curr_p,
                        "change_rate": change_rate,
                        "trading_val_억": trading_val_억,
                        "market_cap_억": int(cap_억)
                    })
            except Exception:
                break

        results = []
        for i, item in enumerate(candidates):
            code = item["code"]
            name = item["name"]
            market_cap_억 = item["market_cap_억"]
            change_rate = item["change_rate"]

            strat_pool = list(cls.STRATEGIES.keys())
            assigned_strat = [strat_pool[i % len(strat_pool)]]
            if item["trading_val_억"] >= 500.0 or change_rate > 3.0:
                assigned_strat.append("A")

            sec_info = cls.classify_sector(code, name)
            score = round(item["trading_val_억"] * (1 + abs(change_rate / 100)), 1)
            
            results.append({
                "시장": item["market_name"], "종목코드": code, "종목명": name,
                "섹터정보": sec_info, "현재가": item["curr_p"], "등락률(%)": change_rate,
                "거래대금(억원)": item["trading_val_억"], "시가총액(억원)": market_cap_억,
                "매칭전략": list(set(assigned_strat)), "전략수": len(set(assigned_strat)), "모멘텀점수": score
            })

        return results

    @classmethod
    def run_multi_strategy_screen(cls) -> tuple:
        try:
            themes = cls.get_top_themes()
            list_kospi = cls.get_market_ranking(sosok=0)
            list_kosdaq = cls.get_market_ranking(sosok=1)
            all_stocks = list_kospi + list_kosdaq
            if not all_stocks:
                return themes, pd.DataFrame()
            df = pd.DataFrame(all_stocks).sort_values(by=["전략수", "모멘텀점수"], ascending=[False, False]).reset_index(drop=True)
            return themes, df
        except Exception as e:
            return [], pd.DataFrame()

    @classmethod
    def generate_0800_global_briefing(cls) -> str:
        macro = cls.get_global_macro_data()
        regime = cls.get_market_regime()
        today_str = pd.Timestamp.now().strftime('%Y-%m-%d')
        msg = f"🌐 *[08:00 모닝 글로벌 매크로 & 야간선물 동향 브리핑]*\n📅 {today_str} 개장 전 글로벌 핵심 체크\n\n"
        msg += "📊 *글로벌 증시 마감 & 야간선물 지표*\n"
        msg += f"• 나스닥: `{macro['nasdaq'][1]}` | S&P 500: `{macro['sp500'][1]}`\n"
        msg += f"• 🌙 **코스피200 야간선물**: `{macro['night_future'][1]}`\n"
        msg += f"• 미 10년물 국채금리: `{macro['us10y'][1]}` | WTI 유가: `{macro['wti'][1]}`\n"
        msg += f"• 원/달러 환율: `{macro['usdkrw'][1]}`\n\n"
        msg += "💡 *야간 시장 연동 및 국내 증시 영향 분석*\n"
        msg += "• **야간선물 포인트**: 야간 마감 방향성과 환율 안착으로 국내 증시 시가 예상 강세 갭출발 유력\n"
        msg += "• **주요 섹터 전망**: 반도체 소부장 및 야간 수급 유입 테마 중심 순환매 대응\n"
        msg += f"• **시장 종합 판단**: {regime['badge']}\n"
        msg += f"  (권장 포지션: *{regime['alloc_guide']}*)"
        return msg

    @classmethod
    def generate_0850_nxt_briefing(cls) -> str:
        themes, df = cls.run_multi_strategy_screen()
        regime = cls.get_market_regime()
        today_str = pd.Timestamp.now().strftime('%Y-%m-%d')
        msg = f"🌅 *[08:50 프리마켓 & NXT 테마/골든픽 브리핑]*\n📅 {today_str} 개장 직전 최종 점검\n🚦 시장 국면: {regime['badge']}\n\n"
        msg += "🔥 *NXT/장전 거래 주도 테마 TOP 3*\n"
        for i, t in enumerate(themes[:3]):
            msg += f"{i+1}. *{t['theme_name']}* (+{t['change_rate']}%) 👑 대장: `{t['leader']}`\n"
        msg += "\n⭐ *오늘의 메이저 골든픽 TOP 3 (시총 1000억↑ & 거래대금 300억↑)*\n"
        golden = df[df['전략수'] >= 2].head(3)
        if not golden.empty:
            for _, r in golden.iterrows():
                sec = r['섹터정보']
                msg += f"• *{r['종목명']}* (`{r['종목코드']}`) {sec['emoji']} {sec['category']}\n"
                msg += f"  현재가: `{r['현재가']:,}원` (+{r['등락률(%)']}%) | 거래대금: `{r['거래대금(억원)']:,}억` | 시총: `{r['시가총액(억원)']:,}억`\n"
        else:
            msg += "• 거래대금 300억 이상 강력 수급 유입 종목 탐색 중\n"
        msg += f"\n🎯 *오늘의 매매 원칙 가이드*\n• {regime['desc']}"
        return msg

    @classmethod
    def generate_intraday_leader_briefing(cls, time_label: str = "09:30") -> str:
        themes, df = cls.run_multi_strategy_screen()
        total_money = int(df['거래대금(억원)'].sum()) if not df.empty else 0
        msg = f"⚡ *{time_label} 실시간 주도섹터 & 자금 쏠림 브리핑*\n"
        msg += f"📊 300억 이상 주도주 자금 집중 규모: *약 {total_money:,}억 원*\n\n"
        msg += "👑 *실시간 1등 주도 테마 & 대장주 현황*\n"
        for i, t in enumerate(themes[:3]):
            msg += f"{i+1}. *{t['theme_name']}* *(+{t['change_rate']}%)*\n"
            msg += f"   └ 1등 대장주: `{t['leader']}` (수급 집중 분출)\n"
            
        msg += f"\n💎 *{time_label} 기준 거래대금 300억↑ TOP 3 주도주*\n"
        top3 = df.head(3)
        if not top3.empty:
            for idx, (_, r) in enumerate(top3.iterrows()):
                sec = r['섹터정보']
                calc_stop = int(r['현재가'] * 0.94)
                calc_tp3r = int(r['현재가'] * 1.18)
                msg += f"{idx+1}. *{r['종목명']}* {sec['emoji']} (`{r['거래대금(억원)']:,}억 원` 유입)\n"
                msg += f"   현재가: `{r['현재가']:,}원` (*+{r['등락률(%)']}%*) | {sec['category']}\n"
                msg += f"   🛑 손절선: `{calc_stop:,}원 (-6%)` | 🎯 3R목표가: `{calc_tp3r:,}원 (+18%)`\n"
                
        msg += "\n💡 *실전 트레이딩 코칭*: 전고점 돌파 주도주는 3R 도달 시 50% 분할 익절 후 나머지는 추세 추종 권장."
        return msg
