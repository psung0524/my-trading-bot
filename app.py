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
import streamlit.components.v1 as components

from main import SamsungSecuritiesParser, TradeFIFOEngine, TradingMetricsAnalyzer, get_best_available_model
from screener import NaverStockScreener
from notifier import TelegramNotifier

CONFIG_DIR = Path(__file__).parent / "user_data"
CONFIG_DIR.mkdir(exist_ok=True)
ENV_FILE = Path(__file__).parent / ".env"
OLD_CONFIG_FILE = Path(__file__).parent / "config.json"
OLD_WATCHLIST_FILE = Path(__file__).parent / "watchlist.json"

load_dotenv(dotenv_path=ENV_FILE, override=True)

# -------------------------------------------------------------
# 1. UI 설정 & 고급 다크 글래스모피즘 스타일링
# -------------------------------------------------------------
st.set_page_config(
    page_title="Alpha Desk Trading Engine",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed"
)

query_params = st.query_params
active_tab = query_params.get("tab", "screener")

# 로컬 스토리지 계정 동기화
url_user = query_params.get("user", "").strip()
if "current_user" not in st.session_state:
    st.session_state["current_user"] = url_user if url_user else "default"

current_user = st.session_state["current_user"]

# 브라우저 영구 계정 기억 스크립트
components.html(f"""
<script>
    const currentParam = new URLSearchParams(window.parent.location.search).get("user");
    const activeUser = "{current_user}";
    
    if (activeUser !== "default" && activeUser !== "") {{
        localStorage.setItem("alpha_trader_id", activeUser);
    }}
    
    const savedUser = localStorage.getItem("alpha_trader_id");
    if (savedUser && (!currentParam || currentParam === "default") && savedUser !== activeUser) {{
        const url = new URL(window.parent.location.href);
        url.searchParams.set("user", savedUser);
        window.parent.location.href = url.toString();
    }}
</script>
""", height=0, width=0)

st.markdown("""
<style>
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');

    .stApp {
        background: radial-gradient(circle at 10% 20%, #0d1527 0%, #080b14 100%) !important;
        color: #f1f5f9 !important;
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, Roboto, sans-serif !important;
    }
    
    .block-container {
        max-width: 640px !important;
        margin: 0 auto !important;
        padding-top: 60px !important;
        padding-bottom: 4rem !important;
        padding-left: 0.9rem !important;
        padding-right: 0.9rem !important;
    }
    
    #MainMenu, footer, header { visibility: hidden !important; display: none !important; }
    
    /* ⚡ 프리미엄 상단 플로팅 네비게이션 바 */
    .glass-top-bar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 52px !important;
        background: rgba(13, 21, 39, 0.82) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        display: flex !important;
        justify-content: space-around !important;
        align-items: center !important;
        z-index: 999999999 !important;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.35) !important;
    }
    
    .glass-tab-item {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-decoration: none !important;
        color: #94a3b8 !important;
        font-size: 0.69rem !important;
        font-weight: 700 !important;
        height: 100% !important;
        border-bottom: 2.5px solid transparent !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
    }
    
    .glass-tab-item.active {
        color: #38bdf8 !important;
        font-weight: 800 !important;
        border-bottom: 2.5px solid #38bdf8 !important;
    }
    
    .glass-tab-icon {
        font-size: 1.1rem;
        margin-bottom: 2px;
    }
    
    /* 💎 글래스모피즘 메인 카드 */
    .glass-card {
        background: rgba(30, 41, 59, 0.55);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 18px;
        padding: 14px 16px;
        margin-bottom: 10px;
        backdrop-filter: blur(12px);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
    }
    
    .golden-glow-card {
        background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(30, 41, 59, 0.6) 100%);
        border: 1.5px solid rgba(245, 158, 11, 0.4);
        border-radius: 18px;
        padding: 14px 16px;
        margin-bottom: 10px;
        box-shadow: 0 4px 20px rgba(245, 158, 11, 0.15);
    }

    .badge-chip {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.73rem;
        font-weight: 700;
        margin-right: 4px;
        margin-bottom: 3px;
    }

    .stButton button {
        border-radius: 12px !important;
        font-weight: 700 !important;
        font-size: 0.82rem !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        background: rgba(30, 41, 59, 0.8) !important;
        color: #f1f5f9 !important;
        padding: 0.4rem 0.6rem !important;
        transition: all 0.15s ease !important;
    }
    
    .stButton button:hover {
        border-color: #38bdf8 !important;
        color: #38bdf8 !important;
    }
    
    .stButton button[kind="primary"] {
        background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%) !important;
        color: #ffffff !important;
        border: none !important;
        box-shadow: 0 2px 10px rgba(37, 99, 235, 0.35) !important;
    }

    div[data-baseweb="input"] {
        border-radius: 12px !important;
        background: rgba(15, 23, 42, 0.6) !important;
        border: 1px solid rgba(255, 255, 255, 0.12) !important;
    }
</style>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# 2. 상단 고정 네비게이션 바
# -------------------------------------------------------------
st.markdown(f"""
<div class="glass-top-bar">
    <a href="?user={current_user}&tab=screener" target="_self" class="glass-tab-item {'active' if active_tab=='screener' else ''}">
        <div class="glass-tab-icon">🎯</div>
        <div>스크리너</div>
    </a>
    <a href="?user={current_user}&tab=monitor" target="_self" class="glass-tab-item {'active' if active_tab=='monitor' else ''}">
        <div class="glass-tab-icon">📡</div>
        <div>포트폴리오</div>
    </a>
    <a href="?user={current_user}&tab=backtest" target="_self" class="glass-tab-item {'active' if active_tab=='backtest' else ''}">
        <div class="glass-tab-icon">🔬</div>
        <div>백테스트</div>
    </a>
    <a href="?user={current_user}&tab=briefing" target="_self" class="glass-tab-item {'active' if active_tab=='briefing' else ''}">
        <div class="glass-tab-icon">📢</div>
        <div>브리핑</div>
    </a>
    <a href="?user={current_user}&tab=report" target="_self" class="glass-tab-item {'active' if active_tab=='report' else ''}">
        <div class="glass-tab-icon">🧠</div>
        <div>복기코칭</div>
    </a>
    <a href="?user={current_user}&tab=settings" target="_self" class="glass-tab-item {'active' if active_tab=='settings' else ''}">
        <div class="glass-tab-icon">⚙️</div>
        <div>설정</div>
    </a>
</div>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# 3. 사용자별 설정 & 파일 관리 함수
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
    if not cfg_file.exists() and OLD_CONFIG_FILE.exists():
        try:
            with open(OLD_CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                with open(cfg_file, "w", encoding="utf-8") as wf:
                    json.dump(data, wf, ensure_ascii=False, indent=2)
        except Exception:
            pass

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
    if not w_file.exists() and OLD_WATCHLIST_FILE.exists():
        try:
            with open(OLD_WATCHLIST_FILE, "r", encoding="utf-8") as f:
                old_data = json.load(f)
                with open(w_file, "w", encoding="utf-8") as wf:
                    json.dump(old_data, wf, ensure_ascii=False, indent=2)
                return old_data
        except Exception:
            pass

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

# -------------------------------------------------------------
# 4. 캐싱 & 고속 시세 조회 엔진
# -------------------------------------------------------------
@st.cache_data(ttl=15, show_spinner=False)
def get_cached_screener_data():
    return NaverStockScreener.run_multi_strategy_screen()

@st.cache_data(ttl=15, show_spinner=False)
def get_cached_market_regime():
    return NaverStockScreener.get_market_regime()

@st.cache_data(ttl=60, show_spinner=False)
def get_naver_theme_directory():
    theme_map = {}
    headers = {'User-Agent': 'Mozilla/5.0'}
    for page in range(1, 8):
        try:
            url = f"https://finance.naver.com/sise/theme.naver?&page={page}"
            res = requests.get(url, headers=headers, timeout=2.5)
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

def fetch_batch_realtime_prices(codes: list) -> dict:
    if not codes:
        return {}
    price_map = {}
    try:
        code_str = ",".join([str(c).zfill(6) for c in codes])
        url = f"https://polling.finance.naver.com/api/realtime/domestic/stock/{code_str}"
        headers = {'User-Agent': 'Mozilla/5.0'}
        res = requests.get(url, headers=headers, timeout=2.5)
        if res.status_code == 200:
            data = res.json()
            if 'result' in data and 'areas' in data['result']:
                for area in data['result']['areas']:
                    for it in area.get('datas', []):
                        c_code = str(it.get('cd', '')).zfill(6)
                        nv = int(it.get('nv', 0))
                        if nv > 0:
                            price_map[c_code] = nv
    except Exception:
        pass
    
    for c in codes:
        c_code = str(c).zfill(6)
        if c_code not in price_map or price_map[c_code] == 0:
            p = fetch_single_stock_price(c_code)
            if p > 0:
                price_map[c_code] = p
    return price_map

def fetch_single_stock_price(code: str):
    try:
        url = f"https://finance.naver.com/item/main.naver?code={code}"
        headers = {'User-Agent': 'Mozilla/5.0'}
        res = requests.get(url, headers=headers, timeout=1.5)
        soup = BeautifulSoup(res.content.decode('cp949', errors='ignore'), 'html.parser')
        no_today = soup.select_one(".no_today .blind")
        if no_today:
            return int(no_today.text.replace(",", "").strip())
    except Exception:
        pass
    return 0

@st.cache_data(ttl=20, show_spinner=False)
def fetch_theme_all_stocks(theme_name: str, theme_no: str = ""):
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
        res = requests.get(url, headers=headers, timeout=3.5)
        soup = BeautifulSoup(res.content.decode('euc-kr', 'replace'), 'html.parser')
        
        for row in soup.select("table.type_5 tr"):
            name_tag = row.select_one("td.name a")
            if not name_tag:
                continue
            name = name_tag.text.strip()
            code = str(name_tag['href'].split('code=')[-1].strip()).zfill(6)
            
            num_tds = row.select("td.number")
            curr_p, chg_rate, amount_eok = 0, 0.0, 0.0
            
            if len(num_tds) >= 3:
                try:
                    curr_p = int(num_tds[0].text.strip().replace(",", ""))
                    chg_txt = num_tds[2].text.strip().replace("%", "").replace("+", "").replace("\n", "").replace("\t", "")
                    chg_rate = float(chg_txt)
                    if "nv01" in str(num_tds[2]) or "하락" in str(num_tds[2]):
                        chg_rate = -abs(chg_rate)
                except Exception:
                    pass
                    
            if len(num_tds) >= 7:
                try:
                    amount_eok = round(float(num_tds[6].text.strip().replace(",", "")) / 100.0, 1)
                except Exception:
                    pass

            if curr_p == 0:
                curr_p = fetch_single_stock_price(code)

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
                    "emoji": "🌱" if "신규상장" in theme_name else ("🌊" if "해운" in theme_name else "🔥"),
                    "bg": "rgba(245, 158, 11, 0.15)",
                    "color": "#f59e0b"
                }
            })
    except Exception:
        pass
    return stocks

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

def render_stock_card(row, tab_prefix: str = "all"):
    curr_p = int(row['현재가'])
    calc_stop = int(curr_p * 0.94)
    calc_tp_3r = int(curr_p * 1.18)

    formatted_money = format_korean_money(row['거래대금(억원)'])
    is_golden = row.get('전략수', 0) >= 2
    card_class = "golden-glow-card" if is_golden else "glass-card"
    golden_badge = "<span class='badge-chip' style='background:#f59e0b; color:#0f172a;'>🔥 다중일치</span> " if is_golden else ""

    strat_badges = ""
    for s_code in row.get('매칭전략', []):
        if s_code == "THEME":
            strat_badges += f"<span class='badge-chip' style='background:#0284c7; color:#ffffff;'>테마구성</span>"
        else:
            info = NaverStockScreener.STRATEGIES.get(s_code, {})
            strat_badges += f"<span class='badge-chip' style='background:#334155; color:#f1f5f9;'>{info.get('badge', s_code)}</span>"

    sec = row.get('섹터정보', {})
    sec_cat = sec.get('category', '주도주')
    raw_ind = sec.get('raw_industry', sec_cat)
    sec_emoji = sec.get('emoji', '🔥')
    sec_bg = sec.get('bg', 'rgba(255,255,255,0.08)')
    sec_color = sec.get('color', '#38bdf8')
    
    tag_label = f"{sec_emoji} {sec_cat}" if sec_cat == raw_ind else f"{sec_emoji} {sec_cat} ({raw_ind})"
    theme_chip = f"<span class='badge-chip' style='background:{sec_bg}; color:{sec_color};'>{tag_label}</span>"

    st.markdown(f"""
    <div class='{card_class}'>
        <div style='display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;'>
            <div>
                {golden_badge}<strong style='font-size:1.05rem; color:#f8fafc;'>{row['종목명']}</strong> <small style='color:#94a3b8;'>{row['종목코드']}</small><br>
                <div style='margin-top:2px;'>{theme_chip}</div>
            </div>
            <div style='text-align:right;'>{strat_badges}</div>
        </div>
        <div style='margin-top: 6px; font-size: 0.95rem; color:#f1f5f9;'>
            <strong>{curr_p:,}원</strong> <span style='color:{'#f87171' if row['등락률(%)']>0 else ('#60a5fa' if row['등락률(%)']<0 else '#94a3b8')}; font-weight:800;'>{row['등락률(%)']:+0.2f}%</span> &nbsp;|&nbsp; 대금 <b>{formatted_money}</b>
        </div>
        <div style='margin-top: 6px; padding: 6px 10px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 10px; font-size: 0.78rem; color: #94a3b8;'>
            🛑 손절: <strong style='color:#f87171;'>{calc_stop:,}원 (-6.0%)</strong> &nbsp;|&nbsp; 
            🎯 3R익절: <strong style='color:#4ade80;'>{calc_tp_3r:,}원 (+18.0%)</strong>
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
                "stop_pct": -6.0,
                "tp_price": calc_tp_3r,
                "tp_pct": 18.0,
                "last_notified_tier": 0,
                "theme": f"{sec_emoji} {sec_cat}",
                "strategy": ",".join(row.get('매칭전략', ['THEME'])),
                "added_at": datetime.now().strftime("%Y-%m-%d %H:%M")
            })
            save_watchlist(current_user, current_list)
            st.toast(f"✅ [{row['종목명']}] {current_user}님 포트폴리오에 등록 완료!")

# -------------------------------------------------------------
# 5. 텔레그램 자동 예약 발송 스케줄러 (무인 자동화)
# -------------------------------------------------------------
saved_creds = load_user_credentials(current_user)
tg_t = saved_creds["tg_token"]
tg_c = saved_creds["tg_chat_id"]

if tg_t and tg_c:
    now = datetime.now()
    today_key = now.strftime("%Y-%m-%d")
    current_time_str = now.strftime("%H:%M")
    
    if "auto_briefing_sent" not in st.session_state:
        st.session_state["auto_briefing_sent"] = {}
        
    sent_dict = st.session_state["auto_briefing_sent"]
    notifier = TelegramNotifier(tg_t, tg_c)

    # 08:00 자동 글로벌 매크로
    if now.hour == 8 and 0 <= now.minute <= 45 and sent_dict.get(f"{today_key}_0800") != True:
        msg = NaverStockScreener.generate_0800_global_briefing()[cite: 1]
        if notifier.send_message(msg):
            sent_dict[f"{today_key}_0800"] = True

    # 08:50 프리마켓
    if now.hour == 8 and 48 <= now.minute <= 59 and sent_dict.get(f"{today_key}_0850") != True:
        msg = NaverStockScreener.generate_0850_nxt_briefing()[cite: 1]
        if notifier.send_message(msg):
            sent_dict[f"{today_key}_0850"] = True

    # 09:30 장초반 주도섹터
    if now.hour == 9 and 30 <= now.minute <= 45 and sent_dict.get(f"{today_key}_0930") != True:
        msg = NaverStockScreener.generate_intraday_leader_briefing("09:30")[cite: 1]
        if notifier.send_message(msg):
            sent_dict[f"{today_key}_0930"] = True

# -------------------------------------------------------------
# 6. 시장 지수 대시보드
# -------------------------------------------------------------
market_regime = get_cached_market_regime()
safe_alloc = market_regime.get('alloc_guide', '주식 50% / 현금 50%').replace("~~", " ~ ").replace("~", "～")[cite: 1]

kospi_pt = str(market_regime.get('kospi_close', '2,650.00'))[cite: 1]
kospi_chg = str(market_regime.get('kospi_change_pct', '0.0'))[cite: 1]
kospi_color = "#f87171" if not kospi_chg.startswith("-") and kospi_chg != "0.0" else ("#60a5fa" if kospi_chg.startswith("-") else "#94a3b8")

kosdaq_pt = str(market_regime.get('kosdaq_close', '860.50'))[cite: 1]
kosdaq_chg = str(market_regime.get('kosdaq_change_pct', '-0.85'))[cite: 1]
kosdaq_color = "#f87171" if not kosdaq_chg.startswith("-") and kosdaq_chg != "0.0" else ("#60a5fa" if kosdaq_chg.startswith("-") else "#94a3b8")

st.markdown(f"""
<div class='glass-card'>
    <div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;'>
        <div style='font-size:1.0rem; font-weight:800; color:#38bdf8;'>{market_regime['badge']}</div>
        <div style='font-size:0.75rem; background:rgba(255,255,255,0.08); padding:3px 8px; border-radius:6px; font-weight:700; color:#cbd5e1;'>👤 {current_user}</div>
    </div>
    <div style='display:flex; gap:8px; margin-bottom:8px;'>
        <div style='flex:1; background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:8px; text-align:center;'>
            <div style='font-size:0.72rem; color:#94a3b8; font-weight:700;'>KOSPI 코스피</div>
            <div style='font-size:1.15rem; font-weight:800; color:{kospi_color};'>{kospi_pt} <span style='font-size:0.75rem;'>({kospi_chg}%)</span></div>
        </div>
        <div style='flex:1; background:rgba(15,23,42,0.7); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:8px; text-align:center;'>
            <div style='font-size:0.72rem; color:#94a3b8; font-weight:700;'>KOSDAQ 코스닥</div>
            <div style='font-size:1.15rem; font-weight:800; color:{kosdaq_color};'>{kosdaq_pt} <span style='font-size:0.75rem;'>({kosdaq_chg}%)</span></div>
        </div>
    </div>
    <div style='font-size:0.82rem; color:#cbd5e1; line-height:1.4;'>
        💡 <b>가이드:</b> {market_regime['desc']}<br>
        🎯 <b>권장 비중:</b> <span style='background:rgba(56, 189, 248, 0.15); color:#38bdf8; font-weight:800; padding:1px 6px; border-radius:4px;'>{safe_alloc}</span>
    </div>
</div>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# TAB 1: 퀀트 스크리너
# -------------------------------------------------------------
if active_tab == "screener":
    c_tit, c_btn = st.columns([3, 1])
    with c_tit:
        st.markdown("#### 🔥 주도 테마 & 메이저 주도주")
    with c_btn:
        run_scan = st.button("🔄 실시간 스캔", use_container_width=True)

    if "selected_theme_filter" not in st.session_state:
        st.session_state["selected_theme_filter"] = None

    if run_scan:
        st.cache_data.clear()
        st.rerun()

    themes_data, all_df = get_cached_screener_data()
    top_themes = themes_data

    if top_themes:
        st.markdown("<div style='font-size:0.82rem; font-weight:700; color:#94a3b8; margin-bottom:6px;'>⚡ 실시간 급등 테마 TOP (클릭 시 전 종목 보기)</div>", unsafe_allow_html=True)
        
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
    
    if active_theme:
        target_theme_data = next((t for t in top_themes if t["theme_name"] == active_theme), None)
        theme_no = target_theme_data.get('theme_no', '') if target_theme_data else ''
        
        with st.spinner(f"[{active_theme}] 테마 관련주 집계 중..."):
            theme_stocks = fetch_theme_all_stocks(active_theme, theme_no)
            
        c_head, c_clear = st.columns([3, 1])
        c_head.markdown(f"##### 🎯 [{active_theme}] 전체 관련주 ({len(theme_stocks)}종목)")
        if c_clear.button("❌ 전체보기", use_container_width=True):
            st.session_state["selected_theme_filter"] = None
            st.rerun()

        if theme_stocks:
            df_theme = pd.DataFrame(theme_stocks)
            for _, r in df_theme.iterrows():
                render_stock_card(r, tab_prefix="theme_all")
        else:
            st.info(f"[{active_theme}] 테마에 등록된 관련 종목을 불러오는 중입니다.")
    else:
        st.markdown("##### 🎯 5대 정밀 트레이딩 전략별 주도주")
        if all_df.empty:
            st.info("💡 현재 거래대금 및 기술적 타점에 일치하는 주도주를 탐색 중입니다.")
        else:
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
                    render_stock_card(r, tab_prefix=tab_prefix)

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
    st.markdown(f"#### 📡 [{current_user}] 감시 포트폴리오 & 5% 알림 센터")
    
    notifier = TelegramNotifier(tg_t, tg_c) if (tg_t and tg_c) else None

    search_kw = st.text_input("🔍 감시 종목 추가", placeholder="예: 삼성전자, 펩트론, 에코프로, 아난티")
    if search_kw:
        found_items = [{"name": search_kw, "code": "005930"}]
        c_in1, c_in2 = st.columns(2)
        with c_in1:
            buy_price_in = st.number_input("매수가 (원)", value=10000, step=500)
        with c_in2:
            stop_pct_in = st.number_input("손절선 (%)", value=6.0, step=0.5)

        if st.button(f"➕ [{search_kw}] 등록", use_container_width=True, type="primary"):
            curr_list = get_saved_watchlist(current_user)
            calc_stop = int(buy_price_in * (1 - (stop_pct_in / 100)))
            calc_tp = int(buy_price_in * (1 + ((stop_pct_in * 3) / 100)))
            curr_list.append({
                "name": search_kw,
                "code": "005930",
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
            st.toast(f"✅ [{search_kw}] 등록 완료!")
            st.rerun()

    current_list = get_saved_watchlist(current_user)
    if not current_list:
        st.info(f"[{current_user}] 계정에 감시 중인 종목이 없습니다. 위에서 종목을 검색해 등록하세요.")
    else:
        all_codes = [item['code'] for item in current_list]
        batch_prices = fetch_batch_realtime_prices(all_codes)

        for item in current_list:
            code = item['code']
            buy_p = item['buy_price']
            real_p = batch_prices.get(str(code).zfill(6), buy_p)
            pnl_pct = round(((real_p - buy_p) / buy_p) * 100, 2)
            stop_p = item['stop_price']
            tp_p = item.get('tp_price', int(buy_p * 1.18))

            st.markdown(f"""
            <div class='glass-card'>
                <div style='display:flex; justify-content:space-between; align-items:center;'>
                    <div>
                        <strong style='font-size:1.05rem; color:#f8fafc;'>{item['name']}</strong> <small style='color:#94a3b8;'>({code})</small>
                    </div>
                    <div style='font-size:0.85rem; font-weight:800; color:{'#f87171' if pnl_pct>0 else '#60a5fa'};'>{pnl_pct:+0.2f}%</div>
                </div>
                <div style='margin-top:4px; font-size:0.92rem; color:#cbd5e1;'>
                    매수가 {buy_p:,}원 ➡️ <b>현재가 {real_p:,}원</b>
                </div>
                <div style='margin-top:6px; padding: 6px 10px; background: rgba(15,23,42,0.6); border-radius: 8px; font-size:0.78rem; color:#94a3b8;'>
                    🛑 손절: <b style='color:#f87171;'>{stop_p:,}원</b> &nbsp;|&nbsp; 🎯 3R익절: <b style='color:#4ade80;'>{tp_p:,}원</b>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            if st.button(f"🗑️ [{item['name']}] 삭제", key=f"del_{code}", use_container_width=True):
                current_list = [s for s in current_list if s["code"] != code]
                save_watchlist(current_user, current_list)
                st.rerun()

# -------------------------------------------------------------
# TAB 4: 4대 타임라인 텔레그램 브리핑
# -------------------------------------------------------------
elif active_tab == "briefing":
    st.markdown(f"#### 📢 [{current_user}] 시간대별 텔레그램 브리핑 센터")
    st.caption("설정된 시간에 자동으로 발송되며, 아래 버튼을 눌러 즉시 전송할 수도 있습니다.")

    c_b1, c_b2 = st.columns(2)
    with c_b1:
        st.markdown("<div class='glass-card'><b>🌐 08:00 글로벌 매크로</b><br><small style='color:#94a3b8;'>미 증시, 야간선물, 환율 분석</small></div>", unsafe_allow_html=True)
        if st.button("📢 08:00 즉시 발송", use_container_width=True):
            if tg_t and tg_c:
                msg = NaverStockScreener.generate_0800_global_briefing()[cite: 1]
                TelegramNotifier(tg_t, tg_c).send_message(msg)
                st.success("발송 완료!")
            else:
                st.warning("설정 탭에서 텔레그램 설정을 저장하세요.")

    with c_b2:
        st.markdown("<div class='glass-card'><b>⚡ 09:30 장초반 주도섹터</b><br><small style='color:#94a3b8;'>오전 거래대금 쏠림 TOP 3</small></div>", unsafe_allow_html=True)
        if st.button("📢 09:30 즉시 발송", use_container_width=True):
            if tg_t and tg_c:
                msg = NaverStockScreener.generate_intraday_leader_briefing("09:30")[cite: 1]
                TelegramNotifier(tg_t, tg_c).send_message(msg)
                st.success("발송 완료!")
            else:
                st.warning("설정 탭에서 텔레그램 설정을 저장하세요.")

# -------------------------------------------------------------
# TAB 6: 시스템 & 계정 전용 설정
# -------------------------------------------------------------
elif active_tab == "settings":
    st.markdown("#### ⚙️ 시스템 설정 및 계정 관리")
    
    with st.container():
        st.markdown(f"""
        <div class='glass-card'>
            <div style='font-size:1.0rem; font-weight:800; color:#38bdf8; margin-bottom:4px;'>👤 사용자 계정 관리</div>
            <div style='font-size:0.8rem; color:#94a3b8;'>현재 로그인 계정: <b>{current_user}</b></div>
        </div>
        """, unsafe_allow_html=True)
        
        new_u = st.text_input("접속 계정 ID 변경", value=current_user)
        if st.button("🔄 계정 전환하기", use_container_width=True, type="primary"):
            if new_u.strip():
                st.session_state["current_user"] = new_u.strip()
                st.query_params["user"] = new_u.strip()
                st.toast(f"✅ '{new_u.strip()}' 계정으로 전환되었습니다!")
                st.rerun()

    st.markdown("<div style='height:8px;'></div>", unsafe_allow_html=True)
    
    with st.container():
        st.markdown(f"""
        <div class='glass-card'>
            <div style='font-size:1.0rem; font-weight:800; color:#38bdf8; margin-bottom:4px;'>🔑 [{current_user}] API & 텔레그램 연동</div>
            <div style='font-size:0.8rem; color:#94a3b8;'>입력하신 설정값은 해당 계정에만 안전하게 개별 저장됩니다.</div>
        </div>
        """, unsafe_allow_html=True)
        
        api_key = st.text_input("Gemini API Key", type="password", value=saved_creds["gemini_api_key"])
        tg_token = st.text_input("텔레그램 Bot Token", type="password", value=saved_creds["tg_token"])
        tg_chat_id = st.text_input("텔레그램 Chat ID", value=saved_creds["tg_chat_id"])
        
        if st.button("💾 설정 영구 저장", use_container_width=True, type="primary"):
            cfg_file = get_user_config_file(current_user)
            with open(cfg_file, "w", encoding="utf-8") as f:
                json.dump({
                    "gemini_api_key": api_key.strip(),
                    "tg_token": tg_token.strip(),
                    "tg_chat_id": tg_chat_id.strip()
                }, f, ensure_ascii=False, indent=2)
            st.toast(f"✅ [{current_user}] 설정이 저장되었습니다!")
            st.rerun()

# -------------------------------------------------------------
# 7. 10초 주기 실시간 자동 리프레시 엔진 (JS Injection)
# -------------------------------------------------------------
components.html("""
<script>
    setTimeout(function() {
        window.parent.document.querySelector('button[kind="secondary"]') && 
        window.parent.location.reload();
    }, 10000);
</script>
""", height=0, width=0)
