import streamlit as st
import pandas as pd
import json
import os
import requests
import urllib.parse
from bs4 import BeautifulSoup
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from google import genai

from main import SamsungSecuritiesParser, TradeFIFOEngine, TradingMetricsAnalyzer, get_best_available_model
from screener import NaverStockScreener
from notifier import TelegramNotifier

CONFIG_DIR = Path(__file__).parent / "user_data"
CONFIG_DIR.mkdir(exist_ok=True)
ENV_FILE = Path(__file__).parent / ".env"

load_dotenv(dotenv_path=ENV_FILE, override=True)

# -------------------------------------------------------------
# 1. 토스증권 스타일 UI & 반응형 CSS
# -------------------------------------------------------------
st.set_page_config(
    page_title="AI 트레이딩 코치",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed"
)

query_params = st.query_params
active_tab = query_params.get("tab", "screener")

url_user = query_params.get("user", "").strip()
if "current_user" not in st.session_state:
    st.session_state["current_user"] = url_user if url_user else "default"

current_user = st.session_state["current_user"]

st.markdown("""
<style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

    .stApp {
        background-color: #f8fafc !important;
        color: #0f172a !important;
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, Roboto, sans-serif !important;
    }
    
    .block-container {
        max-width: 620px !important;
        margin: 0 auto !important;
        padding-top: 54px !important;
        padding-bottom: 3.5rem !important;
        padding-left: 0.8rem !important;
        padding-right: 0.8rem !important;
    }
    
    #MainMenu, footer, header {visibility: hidden !important; display: none !important;}
    
    .mobile-app-top-bar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 50px !important;
        background-color: rgba(255, 255, 255, 0.95) !important;
        backdrop-filter: blur(15px) !important;
        border-bottom: 1px solid #e2e8f0 !important;
        display: flex !important;
        justify-content: space-around !important;
        align-items: center !important;
        z-index: 999999999 !important;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03) !important;
    }
    
    .mobile-app-tab-item {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-decoration: none !important;
        color: #64748b !important;
        font-size: 0.72rem !important;
        font-weight: 700 !important;
        height: 100% !important;
        border-bottom: 3px solid transparent !important;
        transition: all 0.12s ease !important;
        -webkit-tap-highlight-color: transparent !important;
    }
    
    .mobile-app-tab-item.active {
        color: #3182f6 !important;
        font-weight: 900 !important;
        border-bottom: 3px solid #3182f6 !important;
    }
    
    .mobile-app-tab-icon {
        font-size: 1.15rem;
        margin-bottom: 1px;
    }
    
    .toss-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 12px 14px;
        margin-bottom: 8px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    }
    
    .golden-card {
        background: #fffdf5;
        border: 1.5px solid #f59e0b;
        border-radius: 16px;
        padding: 12px 14px;
        margin-bottom: 8px;
        box-shadow: 0 3px 8px rgba(245, 158, 11, 0.06);
    }

    .badge-span {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.73rem;
        font-weight: 700;
        margin-right: 4px;
        margin-bottom: 3px;
    }

    .stButton button {
        border-radius: 10px !important;
        font-weight: 700 !important;
        font-size: 0.8rem !important;
        border: 1px solid #e2e8f0 !important;
        background-color: #ffffff !important;
        color: #1e293b !important;
        padding: 0.35rem 0.5rem !important;
        box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important;
    }
    
    .stButton button[kind="primary"] {
        background-color: #3182f6 !important;
        color: #ffffff !important;
        border: none !important;
    }

    div[data-baseweb="input"] {
        border-radius: 10px !important;
        background-color: #ffffff !important;
    }
</style>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# 2. 상단 고정 네비게이션 바
# -------------------------------------------------------------
st.markdown(f"""
<div class="mobile-app-top-bar">
    <a href="?user={current_user}&tab=screener" target="_self" class="mobile-app-tab-item {'active' if active_tab=='screener' else ''}">
        <div class="mobile-app-tab-icon">🎯</div>
        <div>스크리너</div>
    </a>
    <a href="?user={current_user}&tab=monitor" target="_self" class="mobile-app-tab-item {'active' if active_tab=='monitor' else ''}">
        <div class="mobile-app-tab-icon">📡</div>
        <div>포트폴리오</div>
    </a>
    <a href="?user={current_user}&tab=backtest" target="_self" class="mobile-app-tab-item {'active' if active_tab=='backtest' else ''}">
        <div class="mobile-app-tab-icon">🔬</div>
        <div>백테스트</div>
    </a>
    <a href="?user={current_user}&tab=briefing" target="_self" class="mobile-app-tab-item {'active' if active_tab=='briefing' else ''}">
        <div class="mobile-app-tab-icon">📢</div>
        <div>브리핑</div>
    </a>
    <a href="?user={current_user}&tab=report" target="_self" class="mobile-app-tab-item {'active' if active_tab=='report' else ''}">
        <div class="mobile-app-tab-icon">🧠</div>
        <div>복기코칭</div>
    </a>
</div>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# 3. 사용자별 설정 & 초고속 데이터 캐싱 엔진
# -------------------------------------------------------------
def get_user_config_file(user_id: str) -> Path:
    safe_name = "".join([c for c in user_id if c.isalnum() or c in ('-', '_')]).strip() or "default"
    return CONFIG_DIR / f"config_{safe_name}.json"

def get_user_watchlist_file(user_id: str) -> Path:
    safe_name = "".join([c for c in user_id if c.isalnum() or c in ('-', '_')]).strip() or "default"
    return CONFIG_DIR / f"watchlist_{safe_name}.json"

def load_user_credentials(user_id: str):
    creds = {
        "gemini_api_key": os.getenv("GEMINI_API_KEY", ""),
        "tg_token": os.getenv("TELEGRAM_BOT_TOKEN", ""),
        "tg_chat_id": os.getenv("TELEGRAM_CHAT_ID", "")
    }
    cfg_file = get_user_config_file(user_id)
    if cfg_file.exists():
        try:
            with open(cfg_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                creds["gemini_api_key"] = data.get("gemini_api_key", "")
                creds["tg_token"] = data.get("tg_token", "")
                creds["tg_chat_id"] = data.get("tg_chat_id", "")
        except Exception:
            pass
    return creds

def get_saved_watchlist(user_id: str):
    w_file = get_user_watchlist_file(user_id)
    if not w_file.exists():
        with open(w_file, "w", encoding="utf-8") as f:
            json.dump([], f)
        return []
    try:
        with open(w_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_watchlist(user_id: str, watchlist):
    w_file = get_user_watchlist_file(user_id)
    with open(w_file, "w", encoding="utf-8") as f:
        json.dump(watchlist, f, ensure_ascii=False, indent=2)

@st.cache_data(ttl=600)
def get_naver_theme_directory():
    """네이버 테마명 -> 테마 고유번호(no) 매핑 테이블 캐싱"""
    theme_map = {}
    headers = {'User-Agent': 'Mozilla/5.0'}
    for page in range(1, 8):
        try:
            url = f"https://finance.naver.com/sise/theme.naver?&page={page}"
            res = requests.get(url, headers=headers, timeout=3)
            soup = BeautifulSoup(res.content.decode('euc-kr', 'replace'), 'html.parser')
            rows = soup.select("table.type_1 td.col_type1 a")
            if not rows:
                break
            for a in rows:
                t_name = a.text.strip()
                t_no = a['href'].split('no=')[-1].strip()
                theme_map[t_name] = t_no
        except Exception:
            break
    return theme_map

@st.cache_data(ttl=60)
def fetch_theme_all_stocks(theme_name: str, theme_no: str = ""):
    """테마에 속한 모든 관련 종목을 필터 없이 100% 수집"""
    if not theme_no:
        t_dir = get_naver_theme_directory()
        theme_no = t_dir.get(theme_name, "")
        if not theme_no:
            for k, v in t_dir.items():
                if theme_name in k or k in theme_name:
                    theme_no = v
                    break

    if not theme_no:
        return []

    stocks = []
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    try:
        url = f"https://finance.naver.com/sise/sise_group_detail.naver?type=theme&no={theme_no}"
        res = requests.get(url, headers=headers, timeout=4)
        soup = BeautifulSoup(res.content.decode('euc-kr', 'replace'), 'html.parser')
        
        rows = soup.select("table.type_5 tr")
        for row in rows:
            name_tag = row.select_one("td.name a")
            if not name_tag:
                continue
            name = name_tag.text.strip()
            code = name_tag['href'].split('code=')[-1].strip()
            
            tds = row.select("td")
            if len(tds) < 8:
                continue
                
            curr_str = tds[1].text.strip().replace(",", "")
            curr_p = int(curr_str) if curr_str.isdigit() else 0
            
            chg_str = tds[3].text.strip().replace("%", "").replace("+", "").strip()
            try:
                chg_rate = float(chg_str)
            except Exception:
                chg_rate = 0.0
                
            vol_str = tds[6].text.strip().replace(",", "")
            vol = int(vol_str) if vol_str.isdigit() else 0
            amount_eok = round((curr_p * vol) / 100000000, 1)
            
            stocks.append({
                "종목명": name,
                "종목코드": code,
                "현재가": curr_p,
                "등락률(%)": chg_rate,
                "거래대금(억원)": amount_eok,
                "전략수": 0,
                "매칭전략": ["THEME"],
                "시가총액(억원)": 0,
                "섹터정보": {
                    "category": theme_name,
                    "raw_industry": theme_name,
                    "emoji": "🌊" if "해운" in theme_name else ("🕊️" if "남북" in theme_name else "🔥"),
                    "bg": "#e0f2fe" if "해운" in theme_name else "#fef3c7",
                    "color": "#0369a1" if "해운" in theme_name else "#b45309"
                }
            })
    except Exception:
        pass
        
    return stocks

@st.cache_data(ttl=86400)
def load_all_krx_stocks():
    stocks = []
    headers = {'User-Agent': 'Mozilla/5.0'}
    for sosok in [0, 1]:
        for page in range(1, 10):
            try:
                url = f"https://finance.naver.com/sise/sise_market_sum.naver?sosok={sosok}&page={page}"
                res = requests.get(url, headers=headers, timeout=2.5)
                soup = BeautifulSoup(res.text, 'html.parser')
                links = soup.select("a.tltle")
                if not links:
                    break
                for a in links:
                    name = a.text.strip()
                    code = a['href'].split('code=')[-1].strip()
                    stocks.append({"name": name, "code": code})
            except Exception:
                break

    backup_list = [
        {"name": "삼성전자", "code": "005930"}, {"name": "SK하이닉스", "code": "000660"},
        {"name": "STX그린로지스", "code": "465770"}, {"name": "흥아해운", "code": "003280"},
        {"name": "대한해운", "code": "005880"}, {"name": "HMM", "code": "011200"},
        {"name": "팬오션", "code": "028670"}, {"name": "좋은사람들", "code": "033340"},
        {"name": "아난티", "code": "025980"}, {"name": "현대엘리베이", "code": "017800"},
        {"name": "신원", "code": "009270"}, {"name": "일신석재", "code": "007110"},
        {"name": "펩트론", "code": "087010"}, {"name": "삼천당제약", "code": "000250"},
        {"name": "에코프로", "code": "086520"}, {"name": "에코프로비엠", "code": "247540"},
        {"name": "알테오젠", "code": "196170"}, {"name": "현대차", "code": "005380"}
    ]
    seen = set()
    final_list = []
    for s in backup_list + stocks:
        if s['code'] not in seen:
            seen.add(s['code'])
            final_list.append(s)
    return final_list

def search_stock_by_name(keyword: str):
    if not keyword or len(keyword.strip()) == 0:
        return []
    kw = keyword.strip().lower()
    if kw.isdigit() and len(kw) == 6:
        return [{"name": f"종목코드({kw})", "code": kw}]
    master = load_all_krx_stocks()
    matched = [s for s in master if kw in s['name'].lower() or kw in s['code']]
    matched.sort(key=lambda x: (not x['name'].lower().startswith(kw), len(x['name'])))
    return matched[:10]

def fetch_realtime_price(code: str):
    try:
        url = f"https://finance.naver.com/item/main.naver?code={code}"
        headers = {'User-Agent': 'Mozilla/5.0'}
        res = requests.get(url, headers=headers, timeout=2)
        soup = BeautifulSoup(res.text, 'html.parser')
        no_today = soup.select_one(".no_today .blind")
        if no_today:
            return int(no_today.text.replace(",", "").strip())
    except Exception:
        pass
    return None

def format_korean_money(amount_eok: float) -> str:
    if amount_eok >= 10000:
        jo = int(amount_eok // 10000)
        eok = int(amount_eok % 10000)
        return f"{jo}조 {eok:,}억 원" if eok > 0 else f"{jo}조 원"
    return f"{int(amount_eok):,}억 원"

@st.dialog("📈 실시간 차트 & 호가")
def show_chart_modal(code: str, name: str):
    st.markdown(f"### {name} (`{code}`)")
    st.markdown(f"[🔗 네이버 증권 새 창 열기](https://finance.naver.com/item/main.naver?code={code})")
    chart_url = f"https://ssl.pstatic.net/imgfinance/chart/item/area/day/{code}.png"
    st.image(chart_url, caption="일봉 차트", use_container_width=True)

def render_stock_card(row, default_stop_pct: float, tab_prefix: str = "all"):
    curr_p = int(row['현재가'])
    calc_stop = int(curr_p * (1 - (default_stop_pct / 100)))
    take_profit_3r_pct = round(default_stop_pct * 3.0, 1)
    calc_tp_3r = int(curr_p * (1 + (take_profit_3r_pct / 100)))

    formatted_money = format_korean_money(row['거래대금(억원)'])
    is_golden = row.get('전략수', 0) >= 2
    card_class = "golden-card" if is_golden else "toss-card"
    golden_badge = "<span class='badge-span' style='background-color:#f59e0b; color:#ffffff;'>🔥 다중일치</span> " if is_golden else ""

    strat_badges = ""
    for s_code in row.get('매칭전략', []):
        if s_code == "THEME":
            strat_badges += f"<span class='badge-span' style='background-color:#2563eb; color:#ffffff;'>테마구성</span>"
        else:
            info = NaverStockScreener.STRATEGIES.get(s_code, {})
            strat_badges += f"<span class='badge-span' style='background-color:#334155; color:#ffffff;'>{info.get('badge', s_code)}</span>"

    sec = row.get('섹터정보', {})
    sec_cat = sec.get('category', '주도주')
    raw_ind = sec.get('raw_industry', sec_cat)
    sec_emoji = sec.get('emoji', '🔥')
    sec_bg = sec.get('bg', '#e2e8f0')
    sec_color = sec.get('color', '#0f172a')
    
    tag_label = f"{sec_emoji} {sec_cat}" if sec_cat == raw_ind else f"{sec_emoji} {sec_cat} ({raw_ind})"
    theme_chip = f"<span class='badge-span' style='background-color:{sec_bg}; color:{sec_color};'>{tag_label}</span>"

    st.markdown(f"""
    <div class='{card_class}'>
        <div style='display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;'>
            <div>
                {golden_badge}<strong style='font-size:1.05rem; color:#0f172a;'>{row['종목명']}</strong> <small style='color:#64748b;'>{row['종목코드']}</small><br>
                <div style='margin-top:2px;'>{theme_chip}</div>
            </div>
            <div style='text-align:right;'>{strat_badges}</div>
        </div>
        <div style='margin-top: 6px; font-size: 0.95rem; color:#0f172a;'>
            <strong>{curr_p:,}원</strong> <span style='color:{'#dc2626' if row['등락률(%)']>0 else '#2563eb'}; font-weight:800;'>{row['등락률(%)']:+0.2f}%</span> &nbsp;|&nbsp; 대금 <b>{formatted_money}</b>
        </div>
        <div style='margin-top: 6px; padding: 6px 8px; background: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; font-size: 0.78rem; color: #475569;'>
            🛑 손절: <strong style='color:#dc2626;'>{calc_stop:,}원 (-{default_stop_pct}%)</strong> &nbsp;|&nbsp; 
            🎯 3R익절: <strong style='color:#16a34a;'>{calc_tp_3r:,}원 (+{take_profit_3r_pct}%)</strong>
        </div>
    </div>
    """, unsafe_allow_html=True)

    c_chart, c_act = st.columns([1, 1])
    with c_chart:
        if st.button("📈 차트보기", key=f"chart_{tab_prefix}_{row['종목코드']}_{row.name if hasattr(row, 'name') else row['종목코드']}", use_container_width=True):
            show_chart_modal(row['종목코드'], row['종목명'])
    with c_act:
        unique_btn_key = f"btn_{tab_prefix}_{row['종목코드']}_{row.name if hasattr(row, 'name') else row['종목코드']}"
        if st.button("➕ 감시 등록", key=unique_btn_key, use_container_width=True, type="primary"):
            current_list = get_saved_watchlist(current_user)
            current_list = [s for s in current_list if s["code"] != row["종목코드"]]
            current_list.append({
                "name": row['종목명'],
                "code": str(row['종목코드']).zfill(6),
                "buy_price": curr_p,
                "current_price": curr_p,
                "pnl_pct": 0.0,
                "stop_price": calc_stop,
                "stop_pct": -default_stop_pct,
                "tp_price": calc_tp_3r,
                "tp_pct": take_profit_3r_pct,
                "last_notified_tier": 0,
                "theme": f"{sec_emoji} {sec_cat}",
                "strategy": ",".join(row.get('매칭전략', ['THEME'])),
                "added_at": datetime.now().strftime("%Y-%m-%d %H:%M")
            })
            save_watchlist(current_user, current_list)
            st.toast(f"✅ [{row['종목명']}] {current_user}님 포트폴리오에 등록 완료!")

# -------------------------------------------------------------
# 4. 사이드바 (사용자 전환 및 개별 설정)
# -------------------------------------------------------------
saved_creds = load_user_credentials(current_user)

with st.sidebar:
    st.header("👤 사용자 계정 관리")
    user_input = st.text_input("접속 계정 ID", value=current_user)
    if st.button("🔄 계정 전환", use_container_width=True):
        if user_input.strip():
            st.session_state["current_user"] = user_input.strip()
            st.query_params["user"] = user_input.strip()
            st.toast(f"✅ '{user_input.strip()}' 계정으로 전환되었습니다.")
            st.rerun()
            
    st.info(f"현재 접속 계정: **`{current_user}`**\n\n내 전용 링크:\n`?user={current_user}`")

    st.divider()
    st.header(f"⚙️ [{current_user}] 전용 설정")
    api_key = st.text_input("Gemini API Key", type="password", value=saved_creds["gemini_api_key"])
    
    st.header("📲 텔레그램 알림 설정")
    tg_token = st.text_input("Bot Token", type="password", value=saved_creds["tg_token"])
    tg_chat_id = st.text_input("My Chat ID", value=saved_creds["tg_chat_id"])
    
    col_save, col_test = st.columns([1, 1])
    with col_save:
        if st.button("💾 영구 저장", use_container_width=True, type="primary"):
            cfg_file = get_user_config_file(current_user)
            with open(cfg_file, "w", encoding="utf-8") as f:
                json.dump({
                    "gemini_api_key": api_key.strip(),
                    "tg_token": tg_token.strip(),
                    "tg_chat_id": tg_chat_id.strip()
                }, f, ensure_ascii=False, indent=2)
            st.toast(f"✅ [{current_user}] 설정값이 저장되었습니다!")
            st.rerun()

    with col_test:
        if st.button("🔔 연결 테스트", use_container_width=True):
            if tg_token and tg_chat_id:
                notifier = TelegramNotifier(tg_token, tg_chat_id)
                if notifier.send_message(f"✅ *[{current_user}] 계정과 텔레그램이 완벽히 연동되었습니다.*"):
                    st.success("발송 성공!")
                else:
                    st.error("토큰/ID를 확인하세요.")
            else:
                st.warning("토큰과 ID를 입력하세요.")

# -------------------------------------------------------------
# 5. 시장 지수 대시보드
# -------------------------------------------------------------
market_regime = NaverStockScreener.get_market_regime()
safe_alloc = market_regime.get('alloc_guide', '주식 50% / 현금 50%').replace("~~", " ~ ").replace("~", "～")

kospi_pt = str(market_regime.get('kospi_close', '2,650.00'))
kospi_chg = str(market_regime.get('kospi_change_pct', '0.0'))
kospi_color = "#dc2626" if not kospi_chg.startswith("-") and kospi_chg != "0.0" else ("#2563eb" if kospi_chg.startswith("-") else "#475569")

kosdaq_pt = str(market_regime.get('kosdaq_close', '860.50'))
kosdaq_chg = str(market_regime.get('kosdaq_change_pct', '-0.85'))
kosdaq_color = "#dc2626" if not kosdaq_chg.startswith("-") and kosdaq_chg != "0.0" else ("#2563eb" if kosdaq_chg.startswith("-") else "#475569")

st.markdown(f"""
<div class='toss-card'>
    <div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;'>
        <div style='font-size:1.0rem; font-weight:800; color:#0f172a;'>{market_regime['badge']}</div>
        <div style='font-size:0.75rem; background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:bold; color:#475569;'>👤 {current_user}</div>
    </div>
    <div style='display:flex; gap:6px; margin-bottom:6px;'>
        <div style='flex:1; background:#f8fafc; border:1px solid #f1f5f9; border-radius:8px; padding:6px; text-align:center;'>
            <div style='font-size:0.72rem; color:#64748b; font-weight:700;'>KOSPI 코스피</div>
            <div style='font-size:1.1rem; font-weight:800; color:{kospi_color};'>{kospi_pt} <span style='font-size:0.75rem;'>({kospi_chg}%)</span></div>
        </div>
        <div style='flex:1; background:#f8fafc; border:1px solid #f1f5f9; border-radius:8px; padding:6px; text-align:center;'>
            <div style='font-size:0.72rem; color:#64748b; font-weight:700;'>KOSDAQ 코스닥</div>
            <div style='font-size:1.1rem; font-weight:800; color:{kosdaq_color};'>{kosdaq_pt} <span style='font-size:0.75rem;'>({kosdaq_chg}%)</span></div>
        </div>
    </div>
    <div style='font-size:0.82rem; color:#334155; line-height:1.35;'>
        💡 <b>가이드:</b> {market_regime['desc']}<br>
        🎯 <b>권장 비중:</b> <span style='background:#ecfdf5; color:#047857; font-weight:700; padding:1px 5px; border-radius:4px;'>{safe_alloc}</span>
    </div>
</div>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# TAB 1: 퀀트 스크리너 (필터 없는 테마 전 종목 뷰 & 초고속 렌더링)
# -------------------------------------------------------------
if active_tab == "screener":
    st.markdown("#### 🔥 주도 테마 & 1,000억↑ 메이저 주도주")
    c_btn, c_slider = st.columns([1, 2])
    with c_btn:
        run_scan = st.button("🔄 실시간 스캔", use_container_width=True)
    with c_slider:
        default_stop_pct = st.slider("기본 손절선 (%)", min_value=2.0, max_value=12.0, value=6.0, step=0.5)

    if "selected_theme_filter" not in st.session_state:
        st.session_state["selected_theme_filter"] = None

    if run_scan or "multi_screener_df" not in st.session_state:
        with st.spinner("시총·거래대금 1000억↑ 5대 전략 퀀트 분석 중..."):
            themes_data, df_result = NaverStockScreener.run_multi_strategy_screen()
            st.session_state["top_themes"] = themes_data
            st.session_state["multi_screener_df"] = df_result

    top_themes = st.session_state.get("top_themes", [])
    all_df = st.session_state.get("multi_screener_df", pd.DataFrame())

    if top_themes:
        st.markdown("<div style='font-size:0.85rem; font-weight:800; color:#334155; margin-bottom:6px;'>⚡ 실시간 급등 테마 TOP (클릭 시 전 종목 보기)</div>", unsafe_allow_html=True)
        
        t_row1_c1, t_row1_c2 = st.columns(2)
        t_row2_c1, t_row2_c2 = st.columns(2)
        grid_cols = [t_row1_c1, t_row1_c2, t_row2_c1, t_row2_c2]
        
        for i, theme in enumerate(top_themes[:4]):
            t_name = theme['theme_name']
            is_active = st.session_state["selected_theme_filter"] == t_name
            btn_label = f"{'✅ ' if is_active else ''}{t_name} (+{theme['change_rate']}%)"
            
            with grid_cols[i]:
                if st.button(
                    btn_label, 
                    key=f"theme_btn_{i}", 
                    use_container_width=True, 
                    type="primary" if is_active else "secondary",
                    help=f"대장주: {theme['leader']}"
                ):
                    st.session_state["selected_theme_filter"] = None if is_active else t_name
                    st.session_state["selected_theme_no"] = theme.get('theme_no', '')
                    st.rerun()

    st.markdown("<div style='height: 4px;'></div>", unsafe_allow_html=True)
    active_theme = st.session_state.get("selected_theme_filter")
    
    # 🚀 테마 선택 시: 필터 조건 없이 테마 내 모든 관련 종목 현황 리스트업
    if active_theme:
        target_theme_data = next((t for t in top_themes if t["theme_name"] == active_theme), None)
        theme_no = target_theme_data.get('theme_no', '') if target_theme_data else ''
        
        with st.spinner(f"[{active_theme}] 테마 전체 관련주 수집 중..."):
            theme_stocks = fetch_theme_all_stocks(active_theme, theme_no)
            
        c_head, c_clear = st.columns([3, 1])
        c_head.markdown(f"##### 🎯 [{active_theme}] 전체 관련주 ({len(theme_stocks)}종목)")
        if c_clear.button("❌ 전체보기", use_container_width=True):
            st.session_state["selected_theme_filter"] = None
            st.rerun()

        if theme_stocks:
            df_theme = pd.DataFrame(theme_stocks)
            
            # 테마 상승/보합/하락 요약 통계
            up_cnt = len(df_theme[df_theme['등락률(%)'] > 0])
            flat_cnt = len(df_theme[df_theme['등락률(%)'] == 0])
            down_cnt = len(df_theme[df_theme['등락률(%)'] < 0])
            
            st.markdown(f"""
            <div style='display:flex; gap:6px; margin-bottom:8px;'>
                <span class='badge-span' style='background:#fee2e2; color:#dc2626;'>상승 {up_cnt}</span>
                <span class='badge-span' style='background:#f1f5f9; color:#64748b;'>보합 {flat_cnt}</span>
                <span class='badge-span' style='background:#dbeafe; color:#2563eb;'>하락 {down_cnt}</span>
            </div>
            """, unsafe_allow_html=True)
            
            sort_opt = st.radio(
                "정렬 기준",
                ["📈 상승률 높은순", "💰 거래대금 많은순", "📉 하락폭 큰순"],
                horizontal=True,
                label_visibility="collapsed"
            )
            
            if "상승률" in sort_opt:
                df_theme = df_theme.sort_values(by="등락률(%)", ascending=False)
            elif "하락폭" in sort_opt:
                df_theme = df_theme.sort_values(by="등락률(%)", ascending=True)
            else:
                df_theme = df_theme.sort_values(by="거래대금(억원)", ascending=False)

            for _, r in df_theme.iterrows():
                render_stock_card(r, default_stop_pct, tab_prefix="theme_all")
        else:
            st.info(f"[{active_theme}] 테마에 등록된 관련 종목을 불러오고 있습니다.")
    else:
        st.markdown("##### 🎯 5대 정밀 트레이딩 전략별 주도주")
        if not all_df.empty:
            sub_tabs = st.tabs([
                f"전체({len(all_df)})",
                f"다중일치({len(all_df[all_df['전략수'] >= 2])})",
                "A.수급", "B.10일선", "C.20일선", "D.신고가", "E.바닥턴"
            ])
            def render_list(df_subset, tab_prefix: str):
                if df_subset.empty:
                    st.info("해당 조건의 종목이 없습니다.")
                    return
                for _, r in df_subset.iterrows():
                    render_stock_card(r, default_stop_pct, tab_prefix=tab_prefix)

            with sub_tabs[0]: render_list(all_df, "all")
            with sub_tabs[1]: render_list(all_df[all_df['전략수'] >= 2], "golden")
            with sub_tabs[2]: render_list(all_df[all_df['매칭전략'].apply(lambda x: 'A' in x)], "strat_a")
            with sub_tabs[3]: render_list(all_df[all_df['매칭전략'].apply(lambda x: 'B' in x)], "strat_b")
            with sub_tabs[4]: render_list(all_df[all_df['매칭전략'].apply(lambda x: 'C' in x)], "strat_c")
            with sub_tabs[5]: render_list(all_df[all_df['매칭전략'].apply(lambda x: 'D' in x)], "strat_d")
            with sub_tabs[6]: render_list(all_df[all_df['매칭전략'].apply(lambda x: 'E' in x)], "strat_e")

# -------------------------------------------------------------
# TAB 2: 감시 포트폴리오
# -------------------------------------------------------------
elif active_tab == "monitor":
    st.markdown(f"#### 📡 [{current_user}] 감시 포트폴리오 & 5% 변동 알림")
    
    tg_t = saved_creds["tg_token"]
    tg_c = saved_creds["tg_chat_id"]
    notifier = TelegramNotifier(tg_t, tg_c) if (tg_t and tg_c) else None

    st.markdown("<div style='font-size:0.95rem; font-weight:800; color:#0f172a; margin-bottom:6px;'>🔍 감시 종목 추가</div>", unsafe_allow_html=True)
    search_kw = st.text_input("종목명 입력", placeholder="예: 삼성전자, 펩트론, 에코프로, 삼천당제약", label_visibility="collapsed")
    
    if search_kw:
        found_items = search_stock_by_name(search_kw)
        if found_items:
            sel_stock = st.selectbox(
                "검색 결과 선택",
                found_items,
                format_func=lambda x: f"📌 {x['name']} ({x['code']})"
            )
            
            real_p = fetch_realtime_price(sel_stock['code']) or 0
            c_in1, c_in2 = st.columns(2)
            with c_in1:
                buy_price_in = st.number_input("매수가 (원)", value=real_p if real_p > 0 else 10000, step=500)
            with c_in2:
                stop_pct_in = st.number_input("손절선 (%)", value=6.0, step=0.5)

            if st.button(f"➕ [{sel_stock['name']}] 등록", use_container_width=True, type="primary"):
                curr_list = get_saved_watchlist(current_user)
                curr_list = [s for s in curr_list if s["code"] != sel_stock["code"]]
                calc_stop = int(buy_price_in * (1 - (stop_pct_in / 100)))
                calc_tp = int(buy_price_in * (1 + ((stop_pct_in * 3) / 100)))
                
                curr_list.append({
                    "name": sel_stock['name'],
                    "code": str(sel_stock['code']).zfill(6),
                    "buy_price": buy_price_in,
                    "current_price": buy_price_in,
                    "pnl_pct": 0.0,
                    "stop_price": calc_stop,
                    "stop_pct": -stop_pct_in,
                    "tp_price": calc_tp,
                    "tp_pct": stop_pct_in * 3,
                    "last_notified_tier": 0,
                    "theme": "직접등록",
                    "strategy": "CUSTOM",
                    "added_at": datetime.now().strftime("%Y-%m-%d %H:%M")
                })
                save_watchlist(current_user, curr_list)
                st.toast(f"✅ [{sel_stock['name']}] 등록 완료!")
                st.rerun()
        else:
            st.caption(f"'{search_kw}'에 대한 검색 결과가 없습니다.")
    st.markdown("<div style='height:8px;'></div>", unsafe_allow_html=True)

    if st.button("🔄 실시간 시세 조회 & 5% 변동 감시", use_container_width=True, type="primary"):
        st.rerun()

    current_list = get_saved_watchlist(current_user)
    if not current_list:
        st.info(f"[{current_user}] 계정에 감시 중인 종목이 없습니다. 위에서 종목을 검색해 등록하세요.")
    else:
        updated = False
        for item in current_list:
            code = item['code']
            buy_p = item['buy_price']
            
            real_p = fetch_realtime_price(code)
            if real_p:
                item['current_price'] = real_p
                item['pnl_pct'] = round(((real_p - buy_p) / buy_p) * 100, 2)
                updated = True

            curr_p = item.get('current_price', buy_p)
            pnl_pct = item.get('pnl_pct', 0.0)
            stop_p = item['stop_price']
            tp_p = item.get('tp_price', int(buy_p * 1.18))
            last_tier = item.get('last_notified_tier', 0)

            current_tier = int(pnl_pct // 5)
            if current_tier != 0 and current_tier != last_tier and notifier:
                direction = "🚀 급등" if pnl_pct > 0 else "🔻 급락/손절주의"
                alert_msg = (
                    f"{'🟢' if pnl_pct>0 else '🔴'} [{current_user} 포트폴리오 {direction} 5% 변동 알림]\n\n"
                    f"• 종목: {item['name']} ({code})\n"
                    f"• 매수가: {buy_p:,}원 ➡️ 현재가: {curr_p:,}원\n"
                    f"• 수익률: {pnl_pct:+0.2f}%\n"
                    f"• 손절선: {stop_p:,}원 | 3R익절선: {tp_p:,}원\n\n"
                    f"💡 3R 도달 시 50% 분할 익절 후 나머지는 추세 추종 권장."
                )
                if notifier.send_message(alert_msg):
                    item['last_notified_tier'] = current_tier
                    updated = True
                    st.toast(f"📢 [{item['name']}] 5% 변동 텔레그램 발송 완료!")

            if curr_p <= stop_p:
                status_badge = "🛑 <b style='color:#dc2626;'>[손절 발동]</b>"
            elif curr_p <= stop_p * 1.015:
                status_badge = "⚠️ <b style='color:#d97706;'>[손절 주의]</b>"
            elif pnl_pct >= 5.0:
                status_badge = "🔥 <b style='color:#dc2626;'>[5%↑ 급등]</b>"
            elif pnl_pct > 0:
                status_badge = "🟢 <b style='color:#16a34a;'>[수익 순항]</b>"
            else:
                status_badge = "🔵 <b style='color:#2563eb;'>[보통]</b>"

            st.markdown(f"""
            <div class='toss-card'>
                <div style='display:flex; justify-content:space-between; align-items:center;'>
                    <div>
                        <strong style='font-size:1.05rem; color:#0f172a;'>{item['name']}</strong> <small style='color:#64748b;'>({code})</small>
                    </div>
                    <div>{status_badge}</div>
                </div>
                <div style='margin-top:4px; font-size:0.95rem; color:#334155;'>
                    매수가 {buy_p:,}원 ➡️ <b>현재가 {curr_p:,}원</b> 
                    (<span style='font-weight:800; color:{'#dc2626' if pnl_pct>0 else '#2563eb'};'>{pnl_pct:+0.2f}%</span>)
                </div>
                <div style='margin-top:6px; padding: 6px 10px; background: #f8fafc; border-radius: 8px; font-size:0.8rem; color:#64748b;'>
                    🛑 손절: <b style='color:#dc2626;'>{stop_p:,}원</b> &nbsp;|&nbsp; 🎯 3R익절: <b style='color:#16a34a;'>{tp_p:,}원</b>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            if st.button(f"🗑️ [{item['name']}] 삭제", key=f"del_{code}", use_container_width=True):
                current_list = [s for s in current_list if s["code"] != code]
                save_watchlist(current_user, current_list)
                st.toast(f"{item['name']} 삭제 완료")
                st.rerun()

        if updated:
            save_watchlist(current_user, current_list)

# -------------------------------------------------------------
# TAB 3: 20년 팩트 백테스팅
# -------------------------------------------------------------
elif active_tab == "backtest":
    st.markdown("#### 🔬 5대 전략 20년 팩트 백테스팅")

    PRESET_STOCKS = {
        "SK하이닉스 (000660)": "000660", "삼성전자 (005930)": "005930",
        "현대무벡스 (319400)": "319400", "한화오션 (042660)": "042660",
        "실리콘투 (257720)": "257720", "두산에너빌리티 (034020)": "034020",
        "대한항공 (003490)": "003490", "코오롱티슈진 (950160)": "950160",
        "직접 종목코드 입력": "CUSTOM"
    }

    sel_preset = st.selectbox("검증할 종목 선택", list(PRESET_STOCKS.keys()))
    if sel_preset == "직접 종목코드 입력":
        target_code = st.text_input("종목코드 6자리", value="005930")
        target_name = f"종목({target_code})"
    else:
        target_code = PRESET_STOCKS[sel_preset]
        target_name = sel_preset.split(" ")[0]

    sel_strat_type = st.selectbox(
        "검증할 진입 전략", ["A", "B", "C", "D", "E"],
        format_func=lambda x: NaverStockScreener.STRATEGIES[x]["name"]
    )

    sel_exit_rule = st.selectbox(
        "청산 전략", [
            ("3R_TRAILING", "🏆 3R 50%익절 + 트레일링스탑"),
            ("SR_RETEST", "🔁 저항선 50%익절 + 지지 리테스트"),
            ("MA5_EXIT", "⚡ 5일선 종가 이탈"),
            ("MA10_EXIT", "🎯 10일선 종가 이탈"),
            ("MA20_EXIT", "🛡️ 20일 생명선 종가 이탈")
        ],
        format_func=lambda x: x[1]
    )[0]

    c_p1, c_p2, c_p3 = st.columns(3)
    with c_p1:
        period_days = st.selectbox("검증 기간", [250, 500, 1250, 2500, 5000], index=4,
                                   format_func=lambda x: {250: "1년", 500: "2년", 1250: "5년", 2500: "10년", 5000: "20년"}[x])
    with c_p2:
        bt_stop = st.number_input("손절선(%)", min_value=2.0, max_value=15.0, value=6.0, step=0.5)
    with c_p3:
        bt_trailing_pct = st.number_input("트레일링(%)", min_value=2.0, max_value=20.0, value=5.0, step=0.5)

    if st.button("🚀 실제 캔들 팩트 백테스팅 실행", use_container_width=True, type="primary") or "real_bt_result" not in st.session_state:
        with st.spinner(f"[{target_name}] 과거 데이터 백테스팅 중..."):
            st.session_state["real_bt_result"] = NaverStockScreener.run_real_stock_backtest(
                code=target_code,
                stock_name=target_name,
                stop_loss_pct=bt_stop,
                strategy_type=sel_strat_type,
                exit_rule=sel_exit_rule,
                trailing_stop_pct=bt_trailing_pct,
                target_days=period_days
            )

    bt_res = st.session_state.get("real_bt_result", {})
    if "error" in bt_res:
        st.error(bt_res["error"])
    elif bt_res:
        m1, m2 = st.columns(2)
        m1.metric("최종 손익", f"{bt_res['final_capital']:,}원", f"{bt_res['total_return_pct']:+0.1f}%")
        m2.metric("매매 승률", f"{bt_res['win_rate_pct']}%", f"{bt_res['total_trades']}회 체결")

        st.markdown("##### 📈 계좌 자산 성장 곡선")
        st.line_chart(pd.DataFrame({"자산 잔고": bt_res["equity_curve"]}))

        df_log = bt_res["trades_log"]
        if not df_log.empty:
            with st.expander(f"📋 체결 상세 로그 ({len(df_log)}건)"):
                st.dataframe(df_log, use_container_width=True, hide_index=True)

# -------------------------------------------------------------
# TAB 4: 4대 타임라인 텔레그램 브리핑
# -------------------------------------------------------------
elif active_tab == "briefing":
    st.markdown(f"#### 📢 [{current_user}] 시간대별 4대 텔레그램 브리핑 센터")
    st.caption(f"발송 버튼을 누르면 [{current_user}] 계정에 설정된 텔레그램 봇으로 즉시 전송됩니다.")

    tg_t = saved_creds["tg_token"]
    tg_c = saved_creds["tg_chat_id"]

    c_b1, c_b2 = st.columns(2)
    with c_b1:
        with st.container():
            st.markdown("""
            <div class='toss-card'>
                <div style='font-size:1.0rem; font-weight:800; margin-bottom:4px;'>🌐 08:00 글로벌 매크로</div>
                <div style='font-size:0.8rem; color:#64748b; margin-bottom:8px;'>미 3대 지수, 환율, 국채금리 분석</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("📢 08:00 발송", use_container_width=True):
                if tg_t and tg_c:
                    with st.spinner("08:00 브리핑 생성 중..."):
                        msg = NaverStockScreener.generate_0800_global_briefing()
                        TelegramNotifier(tg_t, tg_c).send_message(msg)
                        st.success("발송 완료!")
                        st.markdown(msg)
                else:
                    st.warning("사이드바에서 텔레그램 설정을 먼저 저장하세요.")

        with st.container():
            st.markdown("""
            <div class='toss-card'>
                <div style='font-size:1.0rem; font-weight:800; margin-bottom:4px;'>⚡ 09:30 장초반 주도섹터</div>
                <div style='font-size:0.8rem; color:#64748b; margin-bottom:8px;'>개장 30분 거래대금 쏠림 TOP 3</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("📢 09:30 발송", use_container_width=True):
                if tg_t and tg_c:
                    with st.spinner("09:30 브리핑 생성 중..."):
                        msg = NaverStockScreener.generate_intraday_leader_briefing("09:30")
                        TelegramNotifier(tg_t, tg_c).send_message(msg)
                        st.success("발송 완료!")
                        st.markdown(msg)
                else:
                    st.warning("사이드바에서 텔레그램 설정을 먼저 저장하세요.")

    with c_b2:
        with st.container():
            st.markdown("""
            <div class='toss-card'>
                <div style='font-size:1.0rem; font-weight:800; margin-bottom:4px;'>🌅 08:50 프리마켓&골든픽</div>
                <div style='font-size:0.8rem; color:#64748b; margin-bottom:8px;'>NXT 테마 & 5대 전략 골든픽 TOP 3</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("📢 08:50 발송", use_container_width=True):
                if tg_t and tg_c:
                    with st.spinner("08:50 브리핑 생성 중..."):
                        msg = NaverStockScreener.generate_0850_nxt_briefing()
                        TelegramNotifier(tg_t, tg_c).send_message(msg)
                        st.success("발송 완료!")
                        st.markdown(msg)
                else:
                    st.warning("사이드바에서 텔레그램 설정을 먼저 저장하세요.")

        with st.container():
            st.markdown("""
            <div class='toss-card'>
                <div style='font-size:1.0rem; font-weight:800; margin-bottom:4px;'>🔥 10:00 장중 확정 주도주</div>
                <div style='font-size:0.8rem; color:#64748b; margin-bottom:8px;'>오전장 거래대금 수천억 집중 주도주</div>
            </div>
            """, unsafe_allow_html=True)
            if st.button("📢 10:00 발송", use_container_width=True):
                if tg_t and tg_c:
                    with st.spinner("10:00 브리핑 생성 중..."):
                        msg = NaverStockScreener.generate_intraday_leader_briefing("10:00")
                        TelegramNotifier(tg_t, tg_c).send_message(msg)
                        st.success("발송 완료!")
                        st.markdown(msg)
                else:
                    st.warning("사이드바에서 텔레그램 설정을 먼저 저장하세요.")

# -------------------------------------------------------------
# TAB 5: 매매복기 & AI 심층진단
# -------------------------------------------------------------
elif active_tab == "report":
    st.markdown(f"#### 📊 [{current_user}] 삼성증권 매매복기 & AI 진단")
    uploaded_file = st.file_uploader("📂 삼성증권 엑셀(.xlsx) 업로드", type=["xlsx", "xls"])
    if uploaded_file is not None:
        try:
            df = SamsungSecuritiesParser.load_and_normalize(uploaded_file)
            trades = TradeFIFOEngine.process_trades(df)
            metrics = TradingMetricsAnalyzer.generate_summary(trades)

            ov = metrics.get("overview", {})
            c1, c2 = st.columns(2)
            c1.metric("총 매매수", f"{ov.get('total_matched_trades', 0)} 건")
            c2.metric("승률", ov.get('win_rate', '0%'))
            
            c3, c4 = st.columns(2)
            c3.metric("손익비", f"{ov.get('risk_reward_ratio', 0)}")
            c4.metric("실현손익", ov.get('total_net_pnl', '0원'))

            g_key = saved_creds["gemini_api_key"]
            if g_key:
                if st.button("🤖 Gemini AI 복기 진단 받기", use_container_width=True, type="primary"):
                    with st.spinner("AI가 매매 패턴을 정밀 진단 중입니다..."):
                        client = genai.Client(api_key=g_key)
                        prompt = f"다음 통계를 바탕으로 매매 약점과 개선규칙 3가지를 제시하세요:\n{json.dumps(metrics, ensure_ascii=False)}"
                        res = client.models.generate_content(model=get_best_available_model(), contents=prompt)
                        st.markdown("---")
                        st.markdown(res.text)
            else:
                st.warning("사이드바에서 Gemini API 키를 먼저 입력하고 [영구 저장]을 눌러주세요.")
        except Exception as e:
            st.error(f"엑셀 분석 중 오류: {str(e)}")
