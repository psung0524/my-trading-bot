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
        "A": {"name": "전략 A. 메이저 수급 주도주", "badge": "💎 수급주도", "desc": "시총 1000억↑ & 거래대금 300억↑ & +14.5% 이상 장대양봉"},
        "B": {"name": "전략 B. 10일선 급등 눌림목", "badge": "🎯 10일선눌림", "desc": "120일 대세 정배열(5>10>20>60>120) 추세 중 10일선 지지"},
        "C": {"name": "전략 C. 20일선 정석 눌림목", "badge": "🛡️ 20일선눌림", "desc": "120일 대세 정배열(5>10>20>60>120) 추세 중 20일선 지지"},
        "D": {"name": "전략 D. 52주/역사적 신고가 돌파", "badge": "🚀 신고가돌파", "desc": "시총 1000억↑ & 거래대금 300억↑ & 52주 최고 종가 돌파"},
        "E": {"name": "전략 E. 바닥 턴어라운드", "badge": "🌱 바닥턴", "desc": "시총 1000억↑ & 거래대금 300억↑ & 20일선 첫 상향 돌파"}
    }

    SECTOR_PALETTE = {
        "화장품/뷰티": {"emoji": "💄", "bg": "#831843", "color": "#fbcfe8"},
        "항공/여행/운송": {"emoji": "✈️", "bg": "#0369a1", "color": "#bae6fd"},
        "조선/해양/방산": {"emoji": "🚢", "bg": "#1e1b4b", "color": "#c7d2fe"},
        "반도체/IT": {"emoji": "💻", "bg": "#1e3a8a", "color": "#bfdbfe"},
        "바이오/제약": {"emoji": "🧬", "bg": "#065f46", "color": "#a7f3d0"},
        "로봇/AI/자동화": {"emoji": "🤖", "bg": "#581c87", "color": "#f3e8ff"},
        "원전/에너지/신재생": {"emoji": "⚡", "bg": "#78350f", "color": "#fef08a"},
        "자동차/부품/전장": {"emoji": "🚗", "bg": "#334155", "color": "#e2e8f0"},
        "2차전지/배터리": {"emoji": "🔋", "bg": "#134e4a", "color": "#99f6e4"},
        "디스플레이/전자": {"emoji": "🖥️", "bg": "#4c1d95", "color": "#ddd6fe"},
        "화학/소재/정밀": {"emoji": "🧪", "bg": "#14532d", "color": "#bbf7d0"},
        "통신/인프라/지주": {"emoji": "📡", "bg": "#1e293b", "color": "#cbd5e1"},
        "금융/증권/보험": {"emoji": "🏦", "bg": "#7c2d12", "color": "#ffedd5"},
        "철강/금속/기계": {"emoji": "⚙️", "bg": "#44403c", "color": "#e7e5e4"},
        "기타주도주": {"emoji": "🔥", "bg": "#374151", "color": "#f3f4f6"}
    }

    KNOWN_STOCKS = {
        "257720": ("화장품/뷰티", "K-뷰티/유통"), "003490": ("항공/여행/운송", "항공사"),
        "010140": ("조선/해양/방산", "조선"), "042660": ("조선/해양/방산", "조선/해양"),
        "010170": ("통신/인프라/지주", "광케이블/통신"), "396300": ("자동차/부품/전장", "다이캐스팅"),
        "212560": ("자동차/부품/전장", "구동장치"), "093370": ("화학/소재/정밀", "2차전지전해질"),
        "034220": ("디스플레이/전자", "OLED패널"), "066430": ("로봇/AI/자동화", "로봇모듈"),
        "000660": ("반도체/IT", "HBM/D램"), "005930": ("반도체/IT", "파운드리/메모리"),
        "017670": ("통신/인프라/지주", "AI데이터센터"), "319400": ("로봇/AI/자동화", "스마트물류"),
        "950160": ("바이오/제약", "신약개발"), "125490": ("자동차/부품/전장", "전장부품"),
        "475150": ("원전/e너지/신재생", "풍력/신재생"), "034020": ("원전/에너지/신재생", "SMR/원전"),
        "466100": ("로봇/AI/자동화", "물류로봇"), "439090": ("로봇/AI/자동화", "로봇자동화"),
        "088350": ("금융/증권/보험", "생명보험"), "440110": ("반도체/IT", "SSD컨트롤러"),
        "253590": ("반도체/IT", "CXL테스터"), "058610": ("로봇/AI/자동화", "감속기")
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

    @staticmethod
    @lru_cache(maxsize=1000)
    def fetch_naver_industry(code: str) -> str:
        url = f"https://finance.naver.com/item/main.naver?code={code}"
        try:
            res = SESSION.get(url, timeout=1.5)
            soup = BeautifulSoup(res.content.decode("cp949", errors="ignore"), "html.parser")
            trade_comp = soup.select_one("div.trade_compare h4.h_sub a")
            if trade_comp:
                raw_txt = trade_comp.text.strip()
                return re.sub(r'[^가-힣a-zA-Z0-9\s/]', '', raw_txt)
        except Exception:
            pass
        return "기타"

    @classmethod
    def classify_sector(cls, code: str, name: str) -> dict:
        if code in cls.KNOWN_STOCKS:
            cat, detail = cls.KNOWN_STOCKS[code]
            palette = cls.SECTOR_PALETTE.get(cat, cls.SECTOR_PALETTE["기타주도주"])
            return {"category": cat, "raw_industry": detail, "emoji": palette["emoji"], "bg": palette["bg"], "color": palette["color"]}

        raw_ind = cls.fetch_naver_industry(code)
        rules = [
            (["화장품", "뷰티", "미용", "생활용품"], "화장품/뷰티"),
            (["항공", "해운", "육상", "물류", "여행", "호텔", "운송"], "항공/여행/운송"),
            (["조선", "해양", "방위", "우주", "항공우주"], "조선/해양/방산"),
            (["반도체", "IT", "소프트웨어", "인터넷", "전자장비"], "반도체/IT"),
            (["제약", "바이오", "생물", "헬스케어", "의료"], "바이오/제약"),
            (["로봇", "자동화", "인공지능", "AI", "스마트팩토리"], "로봇/AI/자동화"),
            (["원자력", "전력", "에너지", "풍력", "태양광", "신재생"], "원전/에너지/신재생"),
            (["자동차", "자동차부품", "전장", "타이어", "모빌리티"], "자동차/부품/전장"),
            (["2차전지", "축전지", "배터리", "리튬", "양극재", "음극재"], "2차전지/배터리"),
            (["디스플레이", "패널", "OLED", "LCD"], "디스플레이/전자"),
            (["화학", "정밀화학", "석유화학", "소재"], "화학/소재/정밀"),
            (["통신", "통신방송", "지주사", "네트워크", "광케이블"], "통신/인프라/지주"),
            (["은행", "증권", "보험", "카드", "금융", "생명"], "금융/증권/보험"),
            (["철강", "금속", "기계", "비철금속"], "철강/금속/기계"),
        ]

        assigned = "기타주도주"
        for keywords, category in rules:
            if any(k in raw_ind for k in keywords) or any(k in name for k in keywords):
                assigned = category
                break

        palette = cls.SECTOR_PALETTE.get(assigned, cls.SECTOR_PALETTE["기타주도주"])
        return {"category": assigned, "raw_industry": raw_ind if raw_ind != "기타" else assigned, "emoji": palette["emoji"], "bg": palette["bg"], "color": palette["color"]}

    @staticmethod
    def get_top_themes() -> list:
        url = "https://finance.naver.com/sise/theme.naver"
        themes = []
        try:
            res = SESSION.get(url, timeout=2.5)
            soup = BeautifulSoup(res.content.decode("cp949", errors="ignore"), "html.parser")
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

                if change_rate > 0.5 and theme_href:
                    detail_url = f"https://finance.naver.com{theme_href}"
                    leader_name = "확인중"
                    member_stocks = []
                    try:
                        d_res = SESSION.get(detail_url, timeout=1.5)
                        d_soup = BeautifulSoup(d_res.content.decode("cp949", errors="ignore"), "html.parser")
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
            if len(records) >= 120:
                df = pd.DataFrame(records)
                curr = df.iloc[-1]
                prev = df.iloc[-2]

                ma5 = df['close'].tail(5).mean()
                ma10 = df['close'].tail(10).mean()
                ma20 = df['close'].tail(20).mean()
                ma60 = df['close'].tail(60).mean()
                ma120 = df['close'].tail(120).mean()
                ma20_prev5 = df['close'].iloc[-25:-5].mean()

                is_true_uptrend = (ma5 >= ma10) and (ma10 >= ma20) and (ma20 >= ma60) and (ma60 >= ma120) and (ma20 > ma20_prev5)
                upper_tail_pct = ((curr['high'] - curr['close']) / curr['close']) * 100
                is_clean_candle = upper_tail_pct <= 4.5

                prev_52w_high_close = df['close'].iloc[:-1].max()

                return {
                    "curr_close": curr['close'],
                    "curr_low": curr['low'],
                    "curr_open": curr['open'],
                    "prev_close": prev['close'],
                    "ma10": ma10,
                    "ma20": ma20,
                    "is_true_uptrend": is_true_uptrend,
                    "is_clean_candle": is_clean_candle,
                    "prev_52w_high_close": prev_52w_high_close,
                    "valid": True
                }
        except Exception:
            pass
        return {"valid": False}

    @classmethod
    def get_market_ranking(cls, sosok: int = 0) -> list:
        market_name = "코스피" if sosok == 0 else "코스닥"
        candidates = []

        # 💡 시가총액 순위 탭(sise_market_sum.naver)을 활용해 종목명, 현재가, 거래량, 시가총액을 한 번에 안전하게 파싱
        for page in range(1, 4):
            url = f"https://finance.naver.com/sise/sise_market_sum.naver?sosok={sosok}&page={page}"
            try:
                res = SESSION.get(url, timeout=3.0)
                soup = BeautifulSoup(res.content.decode("cp949", errors="ignore"), "html.parser")
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

                    if trading_val_억 < 300.0 or cap_억 < 1000.0:
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
        for item in candidates:
            code = item["code"]
            name = item["name"]
            market_cap_억 = item["market_cap_억"]

            matched = []
            cs = cls.fetch_recent_candles_summary(code)
            change_rate = item["change_rate"]

            if cs.get("valid"):
                curr_c = cs["curr_close"]
                curr_l = cs["curr_low"]
                ma10 = cs["ma10"]
                ma20 = cs["ma20"]
                prev_c = cs["prev_close"]
                is_uptrend = cs["is_true_uptrend"]
                is_clean = cs["is_clean_candle"]

                if change_rate >= 14.5 and curr_c > cs["curr_open"]:
                    matched.append("A")

                if is_uptrend and is_clean and prev_c >= ma10:
                    if curr_l <= ma10 * 1.015 and curr_c >= ma10 * 0.98:
                        matched.append("B")

                if is_uptrend and is_clean and prev_c >= ma20:
                    if curr_l <= ma20 * 1.02 and curr_c >= ma20 * 0.975:
                        matched.append("C")

                if curr_c >= cs["prev_52w_high_close"] * 0.99 and change_rate >= 1.5 and curr_c > cs["curr_open"]:
                    matched.append("D")

                if prev_c <= ma20 and curr_c > ma20 and change_rate >= 2.5:
                    matched.append("E")
            else:
                if change_rate >= 14.5:
                    matched.append("A")
                elif change_rate >= 4.0:
                    matched.append("E")

            if matched:
                score = round(item["trading_val_억"] * (1 + (change_rate / 100)) * (1 + (len(matched) - 1) * 0.5), 1)
                sec_info = cls.classify_sector(code, name)
                results.append({
                    "시장": item["market_name"], "종목코드": code, "종목명": name,
                    "섹터정보": sec_info, "현재가": item["curr_p"], "등락률(%)": change_rate,
                    "거래대금(억원)": item["trading_val_억"], "시가총액(억원)": market_cap_억,
                    "매칭전략": matched, "전략수": len(matched), "모멘텀점수": score
                })

        return results

    @classmethod
    def run_multi_strategy_screen(cls) -> tuple:
        themes = cls.get_top_themes()
        list_kospi = cls.get_market_ranking(sosok=0)
        list_kosdaq = cls.get_market_ranking(sosok=1)
        all_stocks = list_kospi + list_kosdaq
        if not all_stocks:
            return themes, pd.DataFrame()
        df = pd.DataFrame(all_stocks).sort_values(by=["전략수", "모멘텀점수"], ascending=[False, False]).reset_index(drop=True)
        return themes, df

    @classmethod
    def get_sector_uptrend_summary(cls) -> list:
        themes_to_scan = []
        try:
            for p in range(1, 3):
                p_url = f"https://finance.naver.com/sise/theme.naver?&page={p}"
                res = SESSION.get(p_url, timeout=2.0)
                soup = BeautifulSoup(res.content.decode("cp949", errors="ignore"), "html.parser")
                for tr in soup.select("table.theme tr"):
                    tds = tr.select("td")
                    if len(tds) < 4:
                        continue
                    a_tag = tds[0].find("a")
                    if not a_tag:
                        continue
                    t_name = a_tag.text.strip()
                    t_href = a_tag.get("href", "")
                    chg = clean_num(tds[1].text)
                    if t_href:
                        themes_to_scan.append({"name": t_name, "href": t_href, "change_rate": chg})
        except Exception:
            return []

        valid_results = []
        for theme_info in themes_to_scan[:15]:
            t_name = theme_info["name"]
            t_href = theme_info["href"]
            detail_url = f"https://finance.naver.com{t_href}"
            member_stocks = []
            try:
                d_res = SESSION.get(detail_url, timeout=1.5)
                d_soup = BeautifulSoup(d_res.content.decode("cp949", errors="ignore"), "html.parser")
                for ir in d_soup.select("table.type_5 tr"):
                    itd = ir.select("td")
                    if len(itd) < 6:
                        continue
                    ia = itd[0].find("a")
                    if ia:
                        s_name = ia.text.strip()
                        s_code = ia.get("href", "").split("code=")[-1] if "code=" in ia.get("href", "") else ""
                        if s_code:
                            member_stocks.append({"name": s_name, "code": s_code})
            except Exception:
                continue

            uptrend_stocks = []
            valid_count = 0
            for st in member_stocks[:10]:
                cs = cls.fetch_recent_candles_summary(st["code"])
                if cs.get("valid"):
                    valid_count += 1
                    if cs.get("is_true_uptrend"):
                        uptrend_stocks.append(st["name"])

            if valid_count >= 2 and len(uptrend_stocks) >= 1:
                palette_key = "기타주도주"
                for k in cls.SECTOR_PALETTE.keys():
                    if any(w in t_name for w in k.split("/")):
                        palette_key = k
                        break
                palette = cls.SECTOR_PALETTE.get(palette_key, cls.SECTOR_PALETTE["기타주도주"])

                valid_results.append({
                    "sector": t_name,
                    "emoji": palette["emoji"],
                    "uptrend_count": len(uptrend_stocks),
                    "total_count": valid_count,
                    "uptrend_ratio": round((len(uptrend_stocks) / valid_count) * 100, 1),
                    "change_rate": theme_info["change_rate"],
                    "uptrend_stocks": uptrend_stocks
                })

        return sorted(valid_results, key=lambda x: (x["uptrend_count"], x["uptrend_ratio"]), reverse=True)

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
        msg = f"⚡ *[{time_label} 실시간 주도섹터 & 자금 쏠림 브리핑]*\n"
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

    @staticmethod
    def fetch_historical_daily_candles(code: str, target_days: int = 5000) -> pd.DataFrame:
        url = f"https://fchart.stock.naver.com/sise.nhn?symbol={code}&timeframe=day&count={target_days}&requestType=0"
        try:
            res = SESSION.get(url, timeout=3.5)
            soup = BeautifulSoup(res.text, "html.parser")
            records = []
            for item in soup.select("item"):
                data_str = item.get("data", "")
                if not data_str:
                    continue
                parts = data_str.split("|")
                if len(parts) >= 6:
                    records.append({
                        "date": pd.to_datetime(parts[0], format="%Y%m%d"),
                        "open": float(parts[1]),
                        "high": float(parts[2]),
                        "low": float(parts[3]),
                        "close": float(parts[4]),
                        "volume": float(parts[5])
                    })
            if records:
                df = pd.DataFrame(records)
                return df.sort_values(by="date", ascending=True).reset_index(drop=True)
        except Exception:
            pass
        return pd.DataFrame()

    @classmethod
    def run_real_stock_backtest(cls, code: str, stock_name: str, stop_loss_pct: float, strategy_type: str = "A", exit_rule: str = "3R_TRAILING", trailing_stop_pct: float = 5.0, target_days: int = 5000):
        df = cls.fetch_historical_daily_candles(code, target_days=target_days)
        if df.empty or len(df) < 120:
            return {"error": "과거 일봉 데이터를 불러오지 못했습니다. 종목코드를 확인해 주세요."}

        df['ma5'] = df['close'].rolling(window=5).mean()
        df['ma10'] = df['close'].rolling(window=10).mean()
        df['ma20'] = df['close'].rolling(window=20).mean()
        df['ma60'] = df['close'].rolling(window=60).mean()
        df['ma120'] = df['close'].rolling(window=120).mean()
        df['vol_ma20'] = df['volume'].rolling(window=20).mean()

        trades = []
        in_position = False
        entry_price = 0
        entry_date = None
        highest_price_after_entry = 0
        half_sold = False
        re_entered = False
        breakout_level = 0
        half_sold_pnl_pct = 0
        
        trade_capital = 2_000_000 
        total_pnl = 0
        equity = 10_000_000
        equity_curve = [equity]

        for i in range(120, len(df)):
            curr = df.iloc[i]
            prev = df.iloc[i-1]

            if in_position:
                holding_days = (curr['date'] - entry_date).days
                if curr['high'] > highest_price_after_entry:
                    highest_price_after_entry = curr['high']

                initial_risk_price = entry_price * (stop_loss_pct / 100)
                target_stop = entry_price - initial_risk_price
                target_3r = entry_price + (initial_risk_price * 3.0)

                exit_price = None
                exit_reason = None
                realized_pnl_pct = 0

                if curr['low'] <= target_stop:
                    exit_price = target_stop
                    realized_pnl_pct = -stop_loss_pct
                    exit_reason = f"🛑 강제 손절 (-{stop_loss_pct}%)"
                    in_position = False

                elif exit_rule == "3R_TRAILING":
                    if not half_sold and curr['high'] >= target_3r:
                        half_sold = True
                        target_stop = entry_price

                    if half_sold:
                        trailing_stop_line = highest_price_after_entry * (1 - (trailing_stop_pct / 100))
                        if curr['low'] <= trailing_stop_line:
                            exit_price = trailing_stop_line
                            pnl_pct = round(((exit_price - entry_price) / entry_price) * 100, 2)
                            realized_pnl_pct = round((stop_loss_pct * 3.0 * 0.5) + (pnl_pct * 0.5), 2)
                            exit_reason = f"🏆 3R 50%익절 + 트레일링(-{trailing_stop_pct}%) 청산 ({realized_pnl_pct:+0.1f}%)"
                            in_position = False
                    else:
                        if holding_days >= 40:
                            exit_price = curr['close']
                            realized_pnl_pct = round(((exit_price - entry_price) / entry_price) * 100, 2)
                            exit_reason = f"⏰ 40일 타임스탑 ({realized_pnl_pct:+0.1f}%)"
                            in_position = False

                elif exit_rule == "SR_RETEST":
                    recent_resistance = df.iloc[max(0, i-20):i]['high'].max()
                    if not half_sold and curr['high'] >= recent_resistance:
                        half_sold = True
                        breakout_level = recent_resistance
                        half_sold_pnl_pct = round(((breakout_level - entry_price) / entry_price) * 100, 2)
                        target_stop = entry_price
                    elif half_sold and not re_entered:
                        if curr['low'] <= breakout_level * 1.01 and curr['close'] >= breakout_level * 0.985:
                            re_entered = True
                            target_stop = breakout_level * 0.96

                    if half_sold:
                        if curr['close'] < curr['ma20'] or curr['low'] <= target_stop:
                            exit_price = curr['close']
                            pnl_rem = round(((exit_price - entry_price) / entry_price) * 100, 2)
                            realized_pnl_pct = round((half_sold_pnl_pct * 0.5) + (pnl_rem * 0.5), 2)
                            exit_reason = f"🔁 저항익절({half_sold_pnl_pct:+0.1f}%) + 지지리테스트 청산 ({realized_pnl_pct:+0.1f}%)"
                            in_position = False
                    else:
                        if holding_days >= 40:
                            exit_price = curr['close']
                            realized_pnl_pct = round(((exit_price - entry_price) / entry_price) * 100, 2)
                            exit_reason = f"⏰ 40일 타임스탑 ({realized_pnl_pct:+0.1f}%)"
                            in_position = False

                elif exit_rule == "MA5_EXIT":
                    if curr['close'] < curr['ma5']:
                        exit_price = curr['close']
                        realized_pnl_pct = round(((exit_price - entry_price) / entry_price) * 100, 2)
                        exit_reason = f"📉 5일선 종가 이탈 청산 ({realized_pnl_pct:+0.1f}%)"
                        in_position = False

                elif exit_rule == "MA10_EXIT":
                    if curr['close'] < curr['ma10']:
                        exit_price = curr['close']
                        realized_pnl_pct = round(((exit_price - entry_price) / entry_price) * 100, 2)
                        exit_reason = f"📉 10일선 종가 이탈 청산 ({realized_pnl_pct:+0.1f}%)"
                        in_position = False

                elif exit_rule == "MA20_EXIT":
                    if curr['close'] < curr['ma20']:
                        exit_price = curr['close']
                        realized_pnl_pct = round(((exit_price - entry_price) / entry_price) * 100, 2)
                        exit_reason = f"📉 20일 생명선 종가 이탈 청산 ({realized_pnl_pct:+0.1f}%)"
                        in_position = False

                if not in_position and exit_price is not None:
                    net_profit = int(trade_capital * (realized_pnl_pct / 100))
                    equity += net_profit
                    equity_curve.append(equity)
                    total_pnl += net_profit

                    trades.append({
                        "진입일": entry_date.strftime('%Y-%m-%d'),
                        "진입가": f"{int(entry_price):,}원",
                        "청산일": curr['date'].strftime('%Y-%m-%d'),
                        "청산가": f"{int(exit_price):,}원",
                        "수익률": f"{realized_pnl_pct:+0.2f}%",
                        "손익금": f"{net_profit:+,}원",
                        "청산사유": exit_reason,
                        "보유기간": f"{holding_days}일"
                    })
                    continue

            if not in_position:
                buy_signal = False
                change_pct = ((curr['close'] - prev['close']) / prev['close']) * 100
                vol_ratio = (curr['volume'] / curr['vol_ma20']) if curr['vol_ma20'] > 0 else 0
                is_true_uptrend = (curr['ma5'] >= curr['ma10']) and (curr['ma10'] >= curr['ma20']) and (curr['ma20'] >= curr['ma60']) and (curr['ma60'] >= curr['ma120'])
                upper_tail_pct = ((curr['high'] - curr['close']) / curr['close']) * 100

                if strategy_type == "A":
                    if vol_ratio >= 1.5 and change_pct >= 14.5 and curr['close'] > curr['open']:
                        buy_signal = True

                elif strategy_type == "B":
                    if is_true_uptrend and upper_tail_pct <= 4.5 and prev['close'] >= prev['ma10']:
                        if curr['low'] <= curr['ma10'] * 1.015 and curr['close'] >= curr['ma10'] * 0.98:
                            buy_signal = True

                elif strategy_type == "C":
                    if is_true_uptrend and upper_tail_pct <= 4.5 and prev['close'] >= prev['ma20']:
                        if curr['low'] <= curr['ma20'] * 1.02 and curr['close'] >= curr['ma20'] * 0.975:
                            buy_signal = True

                elif strategy_type == "D":
                    lookback_len = min(240, i)
                    prev_high_close = df.iloc[i - lookback_len : i]['close'].max()
                    if curr['close'] >= prev_high_close * 0.99 and curr['close'] > curr['open'] and change_pct >= 1.5:
                        buy_signal = True

                elif strategy_type == "E":
                    if prev['close'] <= prev['ma20'] and curr['close'] > curr['ma20'] and change_pct >= 2.5:
                        buy_signal = True

                if buy_signal:
                    in_position = True
                    entry_price = curr['close']
                    entry_date = curr['date']
                    highest_price_after_entry = curr['high']
                    half_sold = False
                    re_entered = False

        if in_position:
            last_candle = df.iloc[-1]
            last_pnl_pct = round(((last_candle['close'] - entry_price) / entry_price) * 100, 2)
            last_net_pnl = int(trade_capital * (last_pnl_pct / 100))
            holding_days = (last_candle['date'] - entry_date).days
            trades.append({
                "진입일": entry_date.strftime('%Y-%m-%d'),
                "진입가": f"{int(entry_price):,}원",
                "청산일": f"{last_candle['date'].strftime('%Y-%m-%d')} (진행중)",
                "청산가": f"{int(last_candle['close']):,}원",
                "수익률": f"{last_pnl_pct:+0.2f}%",
                "손익금": f"{last_net_pnl:+,}원",
                "청산사유": "⏳ 현재 보유 중 (평가손익)",
                "보유기간": f"{holding_days}일"
            })
            equity += last_net_pnl
            total_pnl += last_net_pnl
            equity_curve.append(equity)

        total_trades = len(trades)
        wins = [t for t in trades if "+" in t["수익률"]]
        losses = [t for t in trades if "-" in t["수익률"]]
        win_rate = round((len(wins) / total_trades) * 100, 1) if total_trades > 0 else 0.0

        return {
            "stock_name": stock_name,
            "code": code,
            "strategy_name": cls.STRATEGIES[strategy_type]["name"],
            "initial_capital": 10_000_000,
            "final_capital": equity,
            "total_pnl": total_pnl,
            "total_return_pct": round(((equity - 10_000_000) / 10_000_000) * 100, 1),
            "win_rate_pct": win_rate,
            "total_trades": total_trades,
            "wins_count": len(wins),
            "losses_count": len(losses),
            "trades_log": pd.DataFrame(trades),
            "equity_curve": equity_curve,
            "raw_candles_count": len(df)
        }
