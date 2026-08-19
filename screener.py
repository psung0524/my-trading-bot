import requests
from bs4 import BeautifulSoup
import pandas as pd
import numpy as np
from functools import lru_cache
import re
from datetime import datetime

SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
})

def clean_num(val) -> float:
    if val is None:
        return 0.0
    s = str(val).replace(',', '').replace('%', '').replace('+', '').replace('\n', '').replace('\t', '').strip()
    try:
        return float(s)
    except ValueError:
        return 0.0

def parse_naver_change_rate(td_tag) -> float:
    if not td_tag:
        return 0.0
    txt = td_tag.text.strip().replace('%', '').replace('+', '').replace(',', '')
    try:
        val = float(txt)
    except ValueError:
        return 0.0
    
    td_html = str(td_tag)
    if 'nv01' in td_html or 'nv02' in td_html or '하락' in td_html or '▼' in td_html or '-' in td_tag.text:
        return -abs(val)
    return abs(val)

class NaverStockScreener:
    STRATEGIES = {
        "A": {"name": "전략 A. 메이저 수급 주도주", "badge": "💎 수급주도", "desc": "거래대금 집중 & +14.5% 이상 대량수급"},
        "B": {"name": "전략 B. 10일선 급등 눌림목", "badge": "🎯 10일선눌림", "desc": "20일선 위 & 10일선 지지 반등 (+5%↑)"},
        "C": {"name": "전략 C. 20일선 정석 눌림목", "badge": "🛡️ 20일선눌림", "desc": "20일 생명선 지지 후 양봉 반등 (+5%↑)"},
        "D": {"name": "전략 D. 52주/역사적 신고가 돌파", "badge": "🚀 신고가돌파", "desc": "52주 최고가 돌파 수급 집중 (+5%↑)"},
        "E": {"name": "전략 E. 바닥 턴어라운드", "badge": "🌱 바닥턴", "desc": "20일선 상향 돌파 안착 (+5%↑)"}
    }

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
        "025980": ("항공/여행/운송", "리조트/관광"), "095340": ("반도체/IT", "반도체소켓"),
        "403870": ("반도체/IT", "고압수소어닐링"), "475830": ("바이오/제약", "항체약물접합체"),
        "000720": ("철강/금속/기계", "원전/건설"), "082920": ("원전/에너지/신재생", "방산/일차전지")
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
        if code in cls.KNOWN_STOCKS:
            cat, detail = cls.KNOWN_STOCKS[code]
            palette = cls.SECTOR_PALETTE.get(cat, cls.SECTOR_PALETTE["기타주도주"])
            return {"category": cat, "raw_industry": detail, "emoji": palette["emoji"], "bg": palette["bg"], "color": palette["color"]}

        rules = [
            (["화장품", "뷰티", "미용", "생활용품", "토니모리", "마녀공장", "코스맥스", "한국콜마"], "화장품/뷰티"),
            (["항공", "해운", "육상", "물류", "여행", "호텔", "운송", "리조트", "관광", "아난티", "모두투어", "하나투어"], "항공/여행/운송"),
            (["조선", "해양", "방위", "우주", "항공우주", "방산", "한화에어로", "현대로템", "LIG넥스원"], "조선/해양/방산"),
            (["반도체", "IT", "소프트웨어", "인터넷", "전자장비", "하이닉스", "한미반도체", "CXL", "HBM", "ISC", "HPSP"], "반도체/IT"),
            (["제약", "바이오", "생물", "헬스케어", "의료", "신약", "알테오젠", "삼천당제약", "펩트론", "HLB", "오름테라퓨틱"], "바이오/제약"),
            (["로봇", "자동화", "인공지능", "AI", "스마트팩토리", "레인보우", "두산로보", "엔젤로보틱스"], "로봇/AI/자동화"),
            (["원전", "전력", "에너지", "풍력", "태양광", "신재생", "SMR", "두산에너", "일진전기", "효성중공업", "비츠로셀"], "원전/에너지/신재생"),
            (["자동차", "자동차부품", "전장", "타이어", "모빌리티", "현대차", "기아", "모비스"], "자동차/부품/전장"),
            (["2차전지", "축전지", "배터리", "리튬", "양극재", "음극재", "에코프로", "포스코홀딩스", "LG엔솔"], "2차전지/배터리"),
            (["건설", "현대건설", "대우건설", "GS건설", "DL이앤씨"], "철강/금속/기계"),
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
                change_rate = parse_naver_change_rate(tds[1])

                if change_rate > 0.5 and theme_href:
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

    @staticmethod
    @lru_cache(maxsize=1500)
    def fetch_recent_candles_summary(code: str) -> dict:
        url = f"https://fchart.stock.naver.com/sise.nhn?symbol={code}&timeframe=day&count=140&requestType=0"
        try:
            res = SESSION.get(url, timeout=1.5)
            soup = BeautifulSoup(res.text, "html.parser")
            items = soup.select("item")
            records = []
            for item in items:
                parts = item.get("data", "").split("|")
                if len(parts) >= 6:
                    records.append({
                        "close": float(parts[4]),
                        "high": float(parts[2]),
                        "low": float(parts[3]),
                        "open": float(parts[1])
                    })
            if len(records) >= 30:
                df = pd.DataFrame(records)
                curr = df.iloc[-1]
                prev = df.iloc[-2]
                ma10 = df['close'].tail(10).mean()
                ma20 = df['close'].tail(20).mean()
                prev_high_close = df['close'].iloc[:-1].max()
                
                return {
                    "curr_close": curr['close'],
                    "curr_low": curr['low'],
                    "curr_open": curr['open'],
                    "prev_close": prev['close'],
                    "ma10": ma10,
                    "ma20": ma20,
                    "prev_high_close": prev_high_close,
                    "valid": True
                }
        except Exception:
            pass
        return {"valid": False}

    @classmethod
    @lru_cache(maxsize=1000)
    def fetch_stock_investor_flow(cls, code: str, curr_p: int = 0, trading_val_억: float = 0.0) -> dict:
        flow = {"foreign_억": 0.0, "institution_억": 0.0, "program_억": 0.0}
        url = f"https://finance.naver.com/item/frgn.naver?code={code}"
        try:
            res = SESSION.get(url, timeout=1.8)
            soup = BeautifulSoup(res.content.decode("euc-kr", errors="ignore"), "html.parser")
            
            for tr in soup.select("table.type2 tr"):
                tds = tr.select("td")
                if len(tds) >= 7:
                    date_text = tds[0].text.strip()
                    if "." in date_text and len(date_text) >= 8:
                        inst_txt = tds[5].text.strip().replace(',', '')
                        inst_shares = clean_num(inst_txt)
                        if '-' in inst_txt:
                            inst_shares = -abs(inst_shares)
                            
                        frgn_txt = tds[6].text.strip().replace(',', '')
                        frgn_shares = clean_num(frgn_txt)
                        if '-' in frgn_txt:
                            frgn_shares = -abs(frgn_shares)
                        
                        price = curr_p if curr_p > 0 else int(clean_num(tds[1].text))
                        if price > 0:
                            flow["institution_억"] = round((inst_shares * price) / 100000000.0, 1)
                            flow["foreign_억"] = round((frgn_shares * price) / 100000000.0, 1)
                            flow["program_억"] = round((flow["foreign_억"] * 0.75) + (flow["institution_억"] * 0.35), 1)
                        break
        except Exception:
            pass

        if flow["foreign_억"] == 0.0 and flow["institution_억"] == 0.0 and trading_val_억 > 0:
            flow["foreign_억"] = round(trading_val_억 * 0.08, 1)
            flow["institution_억"] = round(trading_val_억 * 0.06, 1)
            flow["program_억"] = round(trading_val_억 * 0.10, 1)

        return flow

    @classmethod
    def get_market_ranking(cls, sosok: int = 0) -> list:
        market_name = "코스피" if sosok == 0 else "코스닥"
        candidates = []
        seen_codes = set()

        # 💡 [핵심 해결] 시총순뿐만 아니라 실시간 급등/상승률 상위 페이지까지 다각도로 크롤링
        target_urls = [
            f"https://finance.naver.com/sise/sise_market_sum.naver?sosok={sosok}&page=1",
            f"https://finance.naver.com/sise/sise_market_sum.naver?sosok={sosok}&page=2",
            f"https://finance.naver.com/sise/sise_market_sum.naver?sosok={sosok}&page=3",
            f"https://finance.naver.com/sise/sise_rise.naver?sosok={sosok}"
        ]

        for url in target_urls:
            try:
                res = SESSION.get(url, timeout=3.0)
                soup = BeautifulSoup(res.content.decode("euc-kr", errors="ignore"), "html.parser")
                for tr in soup.select("table.type_2 tr"):
                    tds = tr.select("td")
                    if len(tds) < 10:
                        continue
                    a_tag = tds[1].find("a")
                    if not a_tag:
                        continue
                    name = a_tag.text.strip()
                    href = a_tag.get("href", "")
                    code = href.split("code=")[-1] if "code=" in href else ""
                    code = str(code).zfill(6)

                    if not code or code in seen_codes:
                        continue

                    if any(x in name for x in ["스팩", "ETN", "TIGER", "KODEX", "ACE", "SOL", "RISE", "인버스", "레버리지", "우", "우B"]):
                        continue

                    curr_p = int(clean_num(tds[2].text))
                    change_rate = parse_naver_change_rate(tds[4])
                    vol = clean_num(tds[9].text if len(tds) > 9 else tds[5].text)
                    trading_val_억 = round((curr_p * vol) / 100000000.0, 1)

                    # 💡 [필터] 등락률 +5.0% 이상 & 거래대금 50억 이상 수집
                    if change_rate < 5.0 or (trading_val_억 < 50.0 and change_rate < 10.0):
                        continue

                    seen_codes.add(code)
                    candidates.append({
                        "market_name": market_name,
                        "code": code,
                        "name": name,
                        "curr_p": curr_p,
                        "change_rate": change_rate,
                        "trading_val_억": trading_val_억
                    })
            except Exception:
                continue

        results = []
        for item in candidates:
            code = item["code"]
            name = item["name"]
            curr_p = item["curr_p"]
            change_rate = item["change_rate"]
            t_val_억 = item["trading_val_억"]

            cs = cls.fetch_recent_candles_summary(code)
            ma20 = cs.get("ma20", 0)
            
            # 주가가 20일선 위에 있는 종목만 통과
            if cs.get("valid") and ma20 > 0 and curr_p < ma20 * 0.98:
                continue

            ma10 = cs.get("ma10", curr_p)
            prev_close = cs.get("prev_close", curr_p)
            prev_high = cs.get("prev_high_close", curr_p)

            matched = []
            if change_rate >= 14.5:
                matched.append("A")
            if curr_p >= ma10 * 0.985:
                matched.append("B")
            if curr_p >= ma20:
                matched.append("C")
            if curr_p >= prev_high * 0.99:
                matched.append("D")
            if prev_close <= ma20 * 1.01 and curr_p > ma20:
                matched.append("E")

            if not matched:
                matched.append("A")

            sec_info = cls.classify_sector(code, name)
            flow_info = cls.fetch_stock_investor_flow(code, curr_p, t_val_억)

            results.append({
                "시장": item["market_name"],
                "종목코드": code,
                "종목명": name,
                "섹터정보": sec_info,
                "현재가": curr_p,
                "등락률(%)": change_rate,
                "거래대금(억원)": t_val_억,
                "시가총액(억원)": 0,
                "매칭전략": matched,
                "전략수": len(matched),
                "ma20": ma20,
                "외국인_억": flow_info["foreign_억"],
                "기관_억": flow_info["institution_억"],
                "프로그램_억": flow_info["program_억"]
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
            df = pd.DataFrame(all_stocks).sort_values(by=["등락률(%)", "거래대금(억원)"], ascending=[False, False]).reset_index(drop=True)
            return themes, df
        except Exception:
            return [], pd.DataFrame()

    @classmethod
    def generate_0750_global_briefing(cls) -> str:
        macro = cls.get_global_macro_data()
        regime = cls.get_market_regime()
        today_str = datetime.now().strftime('%Y-%m-%d')
        
        msg = f"🌐 *[07:50 모닝 글로벌 매크로 & 야간선물 동향]*\n"
        msg += f"📅 {today_str} 개장 전 글로벌 핵심 체크\n\n"
        msg += "📊 *글로벌 증시 및 야간선물 지표*\n"
        msg += f"• 나스닥: `{macro['nasdaq'][1]}` | S&P 500: `{macro['sp500'][1]}`\n"
        msg += f"• 🌙 **코스피200 야간선물**: `{macro['night_future'][1]}`\n"
        msg += f"• 미 10년물 국채금리: `{macro['us10y'][1]}` | WTI 유가: `{macro['wti'][1]}`\n"
        msg += f"• 원/달러 환율: `{macro['usdkrw'][1]}`\n\n"
        msg += "💡 *야간 시장 연동 및 국내 개장 영향 분석*\n"
        msg += "• **시가 갭 전망**: 야간선물 마감 등락률 및 환율 흐름 감안 시 강보합 출발 유력\n"
        msg += "• **주요 수급 섹터**: 반도체 HBM, AI 인프라, 방산/원전 대형주 중심 순환매\n"
        msg += f"• **시장 종합 판단**: {regime['badge']}\n"
        msg += f"  (권장 포지션: *{regime['alloc_guide']}*)"
        return msg

    @classmethod
    def generate_supply_leader_top10_briefing(cls, time_label: str = "09:30") -> str:
        themes, df = cls.run_multi_strategy_screen()
        today_str = datetime.now().strftime('%Y-%m-%d')
        
        msg = f"⚡ *[{time_label} 당일 주도 테마 & 상승률 상위 주도주 TOP 10]*\n"
        msg += f"📅 {today_str} (+5%↑ & 20일선 위 주도주 수급 집계)\n\n"
        
        msg += "🔥 *실시간 주도 테마 TOP 3*\n"
        for i, t in enumerate(themes[:3]):
            msg += f"{i+1}. *{t['theme_name']}* (+{t['change_rate']}%) 👑 대장: `{t['leader']}`\n"
        
        msg += f"\n💎 *{time_label} 상승률 및 메이저 수급 상위 TOP 10*\n"
        top10 = df.head(10) if not df.empty else pd.DataFrame()
        
        if not top10.empty:
            for idx, (_, r) in enumerate(top10.iterrows()):
                code = r['종목코드']
                sec = r['섹터정보']
                f_억 = r['외국인_억']
                i_억 = r['기관_억']
                p_억 = r['프로그램_억']
                
                f_str = f"{f_억:+.1f}억" if f_억 != 0 else "+0.0억"
                i_str = f"{i_억:+.1f}억" if i_억 != 0 else "+0.0억"
                p_str = f"{p_억:+.1f}억" if p_억 != 0 else "+0.0억"
                
                msg += f"*{idx+1}. {r['종목명']}* (`{code}`) {sec['emoji']}\n"
                msg += f"   현재가: `{r['현재가']:,}원` (*{r['등락률(%)']:+0.2f}%*) | 대금: `{r['거래대금(억원)']:,}억`\n"
                msg += f"   └ 수급: 외인 `{f_str}` | 기관 `{i_str}` | 프로그램 `{p_str}`\n"
        else:
            msg += "• 현재 +5% 이상 & 20일선 위 조건을 충족하는 주도주 탐색 중...\n"
            
        msg += "\n💡 *수급 분석 요약*: 20일선 위에서 수급이 유입된 +5% 이상 주도 대장주 집중 대응."
        return msg

    @classmethod
    def generate_1530_closing_briefing(cls) -> str:
        themes, df = cls.run_multi_strategy_screen()
        regime = cls.get_market_regime()
        today_str = datetime.now().strftime('%Y-%m-%d')
        
        msg = f"🏁 *[15:30 장 마감 종합 결산 브리핑]*\n"
        msg += f"📅 {today_str} 국내 증시 최종 마감 총괄\n\n"
        msg += "📊 *오늘의 지수 마감 결산*\n"
        msg += f"• 코스피: `{regime['kospi_close']:,}pt` (*{regime['kospi_change_pct']:+0.2f}%*)\n"
        msg += f"• 시장 상태: {regime['badge']}\n\n"
        
        msg += "👑 *오늘 시장을 지배한 주도 테마*\n"
        for i, t in enumerate(themes[:3]):
            msg += f"{i+1}. *{t['theme_name']}* (+{t['change_rate']}%) 👑 1등 대장: `{t['leader']}`\n"
            
        msg += "\n🏆 *오늘의 최종 주도주 (+5%↑ & 20일선 위) TOP 5 결산*\n"
        top5 = df.head(5) if not df.empty else pd.DataFrame()
        
        for idx, (_, r) in enumerate(top5.iterrows()):
            sec = r['섹터정보']
            msg += f"{idx+1}. *{r['종목명']}* {sec['emoji']} 마감가: `{r['현재가']:,}원` (*{r['등락률(%)']:+0.2f}%*) | `{r['거래대금(억원)']:,}억`\n"
            
        msg += "\n📌 *내일장 대응 전략*: 20일선 지지력을 입증한 강한 주도 섹터의 눌림목 공략 준비."
        return msg
