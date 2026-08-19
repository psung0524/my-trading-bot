import streamlit as st
import pandas as pd
import json
import os
import requests
import urllib.parse
from bs4 import BeautifulSoup
from pathlib import Path
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from google import genai
import streamlit.components.v1 as components

from main import SamsungSecuritiesParser, TradeFIFOEngine, TradingMetricsAnalyzer, get_best_available_model
from screener import NaverStockScreener, parse_naver_change_rate, clean_num
from notifier import TelegramNotifier

CONFIG_DIR = Path(__file__).parent / "user_data"
CONFIG_DIR.mkdir(exist_ok=True)
ENV_FILE = Path(__file__).parent / ".env"
OLD_CONFIG_FILE = Path(__file__).parent / "config.json"
OLD_WATCHLIST_FILE = Path(__file__).parent / "watchlist.json"

load_dotenv(dotenv_path=ENV_FILE, override=True)

st.set_page_config(
    page_title="Alpha Desk Trading Engine",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="collapsed"
)

query_params = st.query_params
active_tab = query_params.get("tab", "screener")

url_user = query_params.get("user", "").strip()
if "current_user" not in st.session_state:
    st.session_state["current_user"] = url_user if (url_user and url_user != "default") else "spark"

current_user = st.session_state["current_user"]

components.html(f"""
<script>
    const currentParam = new URLSearchParams(window.parent.location.search).get("user");
    let activeUser = "{current_user}";
    
    if (activeUser && activeUser !== "default") {{
        localStorage.setItem("alpha_trader_id", activeUser);
    }}
    
    const savedUser = localStorage.getItem("alpha_trader_id") || "spark";
    if ((!currentParam || currentParam === "default") && savedUser !== currentParam) {{
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
        background-color: #f8fafc !important;
        color: #0f172a !important;
        font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, Roboto, sans-serif !important;
    }
    
    .block-container {
        max-width: 640px !important;
        margin: 0 auto !important;
        padding-top: 56px !important;
        padding-bottom: 4rem !important;
        padding-left: 0.9rem !important;
        padding-right: 0.9rem !important;
    }
    
    #MainMenu, footer, header { visibility: hidden !important; display: none !important; }
    
    .glass-top-bar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 50px !important;
        background: rgba(255, 255, 255, 0.94) !important;
        backdrop-filter: blur(15px) !important;
        -webkit-backdrop-filter: blur(15px) !important;
        border-bottom: 1px solid #e2e8f0 !important;
        display: flex !important;
        justify-content: space-around !important;
        align-items: center !important;
        z-index: 999999999 !important;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04) !important;
    }
    
    .glass-tab-item {
        flex: 1 !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        justify-content: center !important;
        text-decoration: none !important;
        color: #64748b !important;
        font-size: 0.7rem !important;
        font-weight: 700 !important;
        height: 100% !important;
        border-bottom: 3px solid transparent !important;
        transition: all 0.15s ease !important;
    }
    
    .glass-tab-item.active {
        color: #2563eb !important;
        font-weight: 900 !important;
        border-bottom: 3px solid #2563eb !important;
    }
    
    .glass-tab-icon {
        font-size: 1.1rem;
        margin-bottom: 1px;
    }
    
    .glass-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 14px 16px;
        margin-bottom: 10px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
    }
    
    .golden-glow-card {
        background: #fffdf5;
        border: 1.5px solid #f59e0b;
        border-radius: 16px;
        padding: 14px 16px;
        margin-bottom: 10px;
        box-shadow: 0 3px 10px rgba(245, 158, 11, 0.08);
    }

    .badge-chip {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 800;
        margin-right: 4px;
        margin-bottom: 3px;
    }

    .stButton button {
        border-radius: 10px !important;
        font-weight: 700 !important;
        font-size: 0.82rem !important;
        border: 1px solid #cbd5e1 !important;
        background-color: #ffffff !important;
        color: #1e293b !important;
        padding: 0.4rem 0.6rem !important;
    }
    
    .stButton button[kind="primary"] {
        background-color: #2563eb !important;
        color: #ffffff !important;
        border: none !important;
    }

    div[data-baseweb="input"] {
        border-radius: 10px !important;
        background-color: #ffffff !important;
    }
</style>
""", unsafe_allow_html=True)

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

def get_user_config_file(user_id: str) -> Path:
    safe_name = "".join([c for c in user_id if c.isalnum() or c in ('-', '_')]).strip() or "spark"
    return CONFIG_DIR / f"config_{safe_name}.json"

def get_user_watchlist_file(user_id: str) -> Path:
    safe_name = "".join([c for c in user_id if c.isalnum() or c in ('-', '_')]).strip() or "spark"
    return CONFIG_DIR / f"watchlist_{safe_name}.json"

def load_user_credentials(user_id: str):
    creds = {
        "gemini_api_key": os.getenv("GEMINI_API_KEY", ""),
        "tg_token": os.getenv("TELEGRAM_BOT_TOKEN", ""),
        "tg_chat_id": os.getenv("TELEGRAM_CHAT_ID", "")
    }
    cfg_file = get_user_config_file(user_id)
    if not cfg_file.exists():
        fallback_files = [CONFIG_DIR / "config_spark.json", OLD_CONFIG_FILE, CONFIG_DIR / "config_default.json"]
        for fb in fallback_files:
            if fb.exists():
                try:
                    with open(fb, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        with open(cfg_file, "w", encoding="utf-8") as wf:
                            json.dump(data, wf, ensure_ascii=False, indent=2)
                        break
                except Exception:
                    pass

    if cfg_file.exists():
        try:
            with open(cfg_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                creds["gemini_api_key"] = data.get("gemini_api_key", creds["gemini_api_key"])
                creds["tg_token"] = data.get("tg_token", creds["tg_token"])
                creds["tg_chat_id"] = data.get("tg_chat_id", creds["tg_chat_id"])
        except Exception:
            pass
    return creds

def get_all_registered_configs() -> list:
    configs = []
    seen_chats = set()
    for f_path in CONFIG_DIR.glob("config_*.json"):
        try:
            with open(f_path, "r", encoding="utf-8") as f:
                d = json.load(f)
                token = d.get("tg_token", "").strip()
                chat = d.get("tg_chat_id", "").strip()
                if token and chat and chat not in seen_chats:
                    seen_chats.add(chat)
                    u_id = f_path.stem.replace("config_", "")
                    configs.append({"user_id": u_id, "token": token, "chat_id": chat})
        except Exception:
            pass
    return configs

def get_saved_watchlist(user_id: str):
    w_file = get_user_watchlist_file(user_id)
    if not w_file.exists():
        fallback = CONFIG_DIR / "watchlist_spark.json"
        if fallback.exists():
            w_file = fallback
    try:
        with open(w_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_watchlist(user_id: str, watchlist):
    w_file = get_user_watchlist_file(user_id)
    with open(w_file, "w", encoding="utf-8") as f:
        json.dump(watchlist, f, ensure_ascii=False, indent=2)

@st.cache_data(ttl=120, show_spinner=False)
def get_cached_screener_data():
    return NaverStockScreener.run_multi_strategy_screen()

@st.cache_data(ttl=10, show_spinner=False)
def get_cached_market_regime():
    return NaverStockScreener.get_market_regime()

# 💡 [필터링 없는 테마 전체 종목 수집 함수]
def fetch_theme_all_stocks(theme_name: str, theme_no: str = ""):
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
                    curr_p = int(clean_num(num_tds[0].text))
                    chg_rate = parse_naver_change_rate(num_tds[2])
                except Exception:
                    pass
                    
            if len(num_tds) >= 7:
                try:
                    amount_eok = round(float(clean_num(num_tds[6].text)) / 100.0, 1)
                except Exception:
                    pass

            cs = NaverStockScreener.fetch_recent_candles_summary(code)
            if cs.get("valid") and cs.get("trading_val_억", 0) > 0:
                amount_eok = cs.get("trading_val_억")

            flow_info = NaverStockScreener.fetch_stock_investor_flow(code, curr_p, amount_eok)

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
                    "emoji": "🔥",
                    "bg": "#fef3c7",
                    "color": "#b45309"
                },
                "외국인_억": flow_info["foreign_억"],
                "기관_억": flow_info["institution_억"],
                "프로그램_억": flow_info["program_억"]
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
    chg_r = float(row['등락률(%)'])
    t_val_억 = float(row['거래대금(억원)'])
    
    formatted_money = format_korean_money(t_val_억)
    is_golden = row.get('전략수', 0) >= 2
    card_class = "golden-glow-card" if is_golden else "glass-card"
    golden_badge = "<span class='badge-chip' style='background:#f59e0b; color:#ffffff;'>🔥 다중일치</span> " if is_golden else ""

    strat_badges = ""
    for s_code in row.get('매칭전략', []):
        if s_code == "THEME":
            strat_badges += f"<span class='badge-chip' style='background:#2563eb; color:#ffffff;'>테마구성</span>"
        else:
            info = NaverStockScreener.STRATEGIES.get(s_code, {})
            strat_badges += f"<span class='badge-chip' style='background:#334155; color:#ffffff;'>{info.get('badge', s_code)}</span>"

    sec = row.get('섹터정보', {})
    sec_cat = sec.get('category', '기타주도주')
    sec_emoji = sec.get('emoji', '🔥')
    sec_bg = sec.get('bg', '#f1f5f9')
    sec_color = sec.get('color', '#334155')
    
    tag_label = f"{sec_emoji} {sec_cat}"
    theme_chip = f"<span class='badge-chip' style='background:{sec_bg}; color:{sec_color};'>{tag_label}</span>"

    f_억 = float(row.get('외국인_억', 0.0))
    i_억 = float(row.get('기관_억', 0.0))
    p_억 = float(row.get('프로그램_억', 0.0))

    f_color = "#dc2626" if f_억 > 0 else ("#2563eb" if f_억 < 0 else "#475569")
    i_color = "#dc2626" if i_억 > 0 else ("#2563eb" if i_억 < 0 else "#475569")
    p_color = "#dc2626" if p_억 > 0 else ("#2563eb" if p_억 < 0 else "#475569")

    f_txt = f"{f_억:+.1f}억" if f_억 != 0 else "+0.0억"
    i_txt = f"{i_억:+.1f}억" if i_억 != 0 else "+0.0억"
    p_txt = f"{p_억:+.1f}억" if p_억 != 0 else "+0.0억"

    st.markdown(f"""
    <div class='{card_class}'>
        <div style='display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;'>
            <div>
                {golden_badge}<strong style='font-size:1.1rem; color:#0f172a; font-weight:800;'>{row['종목명']}</strong> <span style='color:#64748b; font-size:0.85rem;'>{row['종목코드']}</span><br>
                <div style='margin-top:4px;'>{theme_chip}</div>
            </div>
            <div style='text-align:right;'>{strat_badges}</div>
        </div>
        <div style='margin-top: 6px; font-size: 1.0rem; color:#0f172a;'>
            <strong style='font-size:1.15rem;'>{curr_p:,}원</strong> <span style='color:{'#dc2626' if chg_r>0 else ('#2563eb' if chg_r<0 else '#64748b')}; font-weight:800;'>{chg_r:+0.2f}%</span> &nbsp;|&nbsp; 대금 <b>{formatted_money}</b>
        </div>
        <div style='margin-top: 6px; padding: 6px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.8rem; color: #475569; display: flex; justify-content: space-between;'>
            <span>외인 <b style='color:{f_color}; font-weight:800;'>{f_txt}</b></span>
            <span>기관 <b style='color:{i_color}; font-weight:800;'>{i_txt}</b></span>
            <span>프로그램 <b style='color:{p_color}; font-weight:800;'>{p_txt}</b></span>
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
                "last_notified_tier": 0,
                "theme": f"{sec_emoji} {sec_cat}",
                "strategy": ",".join(row.get('매칭전략', ['THEME'])),
                "added_at": datetime.now().strftime("%Y-%m-%d %H:%M")
            })
            save_watchlist(current_user, current_list)
            st.toast(f"✅ [{row['종목명']}] {current_user}님 포트폴리오에 등록 완료!")

# -------------------------------------------------------------
# 5. 텔레그램 한국 시간(KST) 무인 자동 발송 스케줄러
# -------------------------------------------------------------
kst = timezone(timedelta(hours=9))
now_kst = datetime.now(kst)
today_key = now_kst.strftime("%Y-%m-%d")
hour_min = now_kst.strftime("%H:%M")

if "auto_briefing_sent" not in st.session_state:
    st.session_state["auto_briefing_sent"] = {}
sent_dict = st.session_state["auto_briefing_sent"]

active_configs = get_all_registered_configs()
if not active_configs:
    saved_creds = load_user_credentials(current_user)
    if saved_creds["tg_token"] and saved_creds["tg_chat_id"]:
        active_configs = [{"user_id": current_user, "token": saved_creds["tg_token"], "chat_id": saved_creds["tg_chat_id"]}]

def broadcast_briefing(task_key: str, message_builder):
    if sent_dict.get(f"{today_key}_{task_key}") != True:
        msg = message_builder()
        for cfg in active_configs:
            TelegramNotifier(cfg["token"], cfg["chat_id"]).send_message(msg)
        sent_dict[f"{today_key}_{task_key}"] = True

if (now_kst.hour == 7 and now_kst.minute >= 50) or (now_kst.hour == 8 and now_kst.minute < 30):
    broadcast_briefing("0750", NaverStockScreener.generate_0750_global_briefing)

if now_kst.hour == 9 and 30 <= now_kst.minute <= 55:
    broadcast_briefing("0930", lambda: NaverStockScreener.generate_supply_leader_top10_briefing("09:30"))

if now_kst.hour == 10 and 0 <= now_kst.minute <= 25:
    broadcast_briefing("1000", lambda: NaverStockScreener.generate_supply_leader_top10_briefing("10:00"))

if (now_kst.hour == 15 and now_kst.minute >= 30) or (now_kst.hour == 16 and now_kst.minute <= 30):
    broadcast_briefing("1530", NaverStockScreener.generate_1530_closing_briefing)

# -------------------------------------------------------------
# 6. 실시간 지수 렌더러
# -------------------------------------------------------------
@st.fragment(run_every="10s")
def render_live_market_dashboard():
    market_regime = get_cached_market_regime()
    safe_alloc = market_regime.get('alloc_guide', '주식 50% / 현금 50%').replace("~~", " ~ ").replace("~", "～")

    kospi_pt = str(market_regime.get('kospi_close', '2,650.00'))
    kospi_chg = str(market_regime.get('kospi_change_pct', '0.0'))
    kospi_color = "#dc2626" if not kospi_chg.startswith("-") and kospi_chg != "0.0" else ("#2563eb" if kospi_chg.startswith("-") else "#0f172a")

    kosdaq_pt = str(market_regime.get('kosdaq_close', '860.50'))
    kosdaq_chg = str(market_regime.get('kosdaq_change_pct', '-0.85'))
    kosdaq_color = "#dc2626" if not kosdaq_chg.startswith("-") and kosdaq_chg != "0.0" else ("#2563eb" if kosdaq_chg.startswith("-") else "#0f172a")

    st.markdown(f"""
    <div class='glass-card'>
        <div style='display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;'>
            <div style='font-size:1.05rem; font-weight:800; color:#0f172a;'>{market_regime['badge']}</div>
            <div style='font-size:0.75rem; background:#f1f5f9; padding:3px 8px; border-radius:6px; font-weight:700; color:#475569;'>👤 {current_user} (KST {hour_min})</div>
        </div>
        <div style='display:flex; gap:8px; margin-bottom:8px;'>
            <div style='flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:8px; text-align:center;'>
                <div style='font-size:0.75rem; color:#64748b; font-weight:700;'>KOSPI 코스피</div>
                <div style='font-size:1.2rem; font-weight:900; color:{kospi_color};'>{kospi_pt} <span style='font-size:0.78rem;'>({kospi_chg}%)</span></div>
            </div>
            <div style='flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:8px; text-align:center;'>
                <div style='font-size:0.75rem; color:#64748b; font-weight:700;'>KOSDAQ 코스닥</div>
                <div style='font-size:1.2rem; font-weight:900; color:{kosdaq_color};'>{kosdaq_pt} <span style='font-size:0.78rem;'>({kosdaq_chg}%)</span></div>
            </div>
        </div>
        <div style='font-size:0.85rem; color:#334155; line-height:1.4;'>
            💡 <b>가이드:</b> {market_regime['desc']}<br>
            🎯 <b>권장 비중:</b> <span style='background:#ecfdf5; color:#047857; font-weight:800; padding:2px 7px; border-radius:5px;'>{safe_alloc}</span>
        </div>
    </div>
    """, unsafe_allow_html=True)

render_live_market_dashboard()

# -------------------------------------------------------------
# TAB 1: 퀀트 스크리너
# -------------------------------------------------------------
if active_tab == "screener":
    c_tit, c_btn = st.columns([3, 1])
    with c_tit:
        st.markdown("<h4 style='color:#0f172a; font-weight:800; margin:0;'>🔥 주도 테마 & 메이저 주도주 (대금 500억↑ & +5%↑)</h4>", unsafe_allow_html=True)
    with c_btn:
        run_scan = st.button("🔄 실시간 스캔", use_container_width=True)

    if "selected_theme_filter" not in st.session_state:
        st.session_state["selected_theme_filter"] = None

    if run_scan:
        st.cache_data.clear()
        st.rerun()

    themes_data, all_df = get_cached_screener_data()
    top_themes = themes_data

    # ⚡ 급등 테마 TOP 버튼 영역
    if top_themes:
        st.markdown("<div style='font-size:0.85rem; font-weight:800; color:#475569; margin-top:8px; margin-bottom:6px;'>⚡ 실시간 급등 테마 TOP (클릭 시 관련 종목 리스트)</div>", unsafe_allow_html=True)
        t_row1_c1, t_row1_c2 = st.columns(2)
        t_row2_c1, t_row2_c2 = st.columns(2)
        grid_cols = [t_row1_c1, t_row1_c2, t_row2_c1, t_row2_c2]
        
        for i, theme in enumerate(top_themes[:4]):
            t_name = theme['theme_name']
            is_active = st.session_state["selected_theme_filter"] == t_name
            btn_label = f"{'✅ ' if is_active else ''}{t_name} (+{theme['change_rate']}%)"
            
            with grid_cols[i]:
                if st.button(btn_label, key=f"theme_btn_{i}", use_container_width=True, type="primary" if is_active else "secondary"):
                    st.session_state["selected_theme_filter"] = None if is_active else t_name
                    st.session_state["selected_theme_no"] = theme.get("theme_no", "")
                    st.rerun()

    st.markdown("<div style='height: 6px;'></div>", unsafe_allow_html=True)
    active_theme = st.session_state.get("selected_theme_filter")

    # 🎯 특정 테마 클릭 시 관련 종목 '무조건' 전부 출력
    if active_theme:
        theme_no = st.session_state.get("selected_theme_no", "")
        with st.spinner(f"[{active_theme}] 관련 전 종목 불러오는 중..."):
            theme_stocks = fetch_theme_all_stocks(active_theme, theme_no)

        c_head, c_clear = st.columns([3, 1])
        c_head.markdown(f"##### 🎯 [{active_theme}] 관련 전 종목 ({len(theme_stocks)}개)")
        if c_clear.button("❌ 전체보기", use_container_width=True):
            st.session_state["selected_theme_filter"] = None
            st.rerun()

        if theme_stocks:
            df_theme = pd.DataFrame(theme_stocks).sort_values(by="거래대금(억원)", ascending=False)
            for _, r in df_theme.iterrows():
                render_stock_card(r, tab_prefix="theme_all")
        else:
            st.info(f"[{active_theme}] 테마에 등록된 관련 종목을 불러오는 중입니다.")
    else:
        # 기본 5대 전략 주도주 리스트 (대금 500억 이상 & +5% 이상 & 20일선 위)
        st.markdown("<h5 style='color:#0f172a; font-weight:800; margin-top:10px;'>🎯 5대 정밀 전략 주도주 (대금 500억↑ & +5%↑)</h5>", unsafe_allow_html=True)
        if all_df.empty:
            st.info("💡 현재 거래대금 500억 원 이상 & 당일 등락률 +5.0% 이상 & 20일선 위에 위치한 메이저 주도주를 탐색 중입니다. (장 마감 시간대이거나 하락장일 경우 엄격히 필터링됩니다.)")
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
    st.markdown(f"#### 📡 [{current_user}] 감시 포트폴리오")
    
    search_kw = st.text_input("🔍 감시 종목 추가", placeholder="예: 삼성전자, 펩트론, 에코프로, 아난티")
    if search_kw:
        c_in1, c_in2 = st.columns(2)
        with c_in1:
            buy_price_in = st.number_input("매수가 (원)", value=10000, step=500)
        with c_in2:
            st.caption("실시간 수급 및 변동 추적")

        if st.button(f"➕ [{search_kw}] 등록", use_container_width=True, type="primary"):
            curr_list = get_saved_watchlist(current_user)
            curr_list.append({
                "name": search_kw,
                "code": "005930",
                "buy_price": buy_price_in,
                "current_price": buy_price_in,
                "pnl_pct": 0.0,
                "last_notified_tier": 0,
                "theme": "직접등록",
                "strategy": "CUSTOM",
                "added_at": datetime.now().strftime("%Y-%m-%d %H:%M")
            })
            save_watchlist(current_user, curr_list)
            st.toast(f"✅ [{search_kw}] 등록 완료!")
            st.rerun()

    @st.fragment(run_every="10s")
    def render_live_portfolio():
        current_list = get_saved_watchlist(current_user)
        if not current_list:
            st.info(f"[{current_user}] 계정에 감시 중인 종목이 없습니다.")
            return

        for item in current_list:
            code = item['code']
            buy_p = item['buy_price']
            real_p = item.get('current_price', buy_p)
            pnl_pct = round(((real_p - buy_p) / buy_p) * 100, 2)

            st.markdown(f"""
            <div class='glass-card'>
                <div style='display:flex; justify-content:space-between; align-items:center;'>
                    <div>
                        <strong style='font-size:1.1rem; color:#0f172a;'>{item['name']}</strong> <span style='color:#64748b; font-size:0.85rem;'>({code})</span>
                    </div>
                    <div style='font-size:1.0rem; font-weight:800; color:{'#dc2626' if pnl_pct>0 else '#2563eb'};'>{pnl_pct:+0.2f}%</div>
                </div>
                <div style='margin-top:6px; font-size:0.95rem; color:#334155;'>
                    매수가 {buy_p:,}원 ➡️ <b>현재가 {real_p:,}원</b>
                </div>
            </div>
            """, unsafe_allow_html=True)
            
            if st.button(f"🗑️ [{item['name']}] 삭제", key=f"del_{code}", use_container_width=True):
                new_list = [s for s in current_list if s["code"] != code]
                save_watchlist(current_user, new_list)
                st.rerun()

    render_live_portfolio()

# -------------------------------------------------------------
# TAB 4: 4대 타임라인 텔레그램 브리핑 센터
# -------------------------------------------------------------
elif active_tab == "briefing":
    st.markdown(f"#### 📢 [{current_user}] 시간대별 텔레그램 4대 브리핑 센터")
    st.caption("정해진 시간(KST 기준)에 자동으로 발송되며, 아래 버튼으로 언제든 즉시 수동 발송할 수 있습니다.")

    saved_creds = load_user_credentials(current_user)
    tg_t = saved_creds["tg_token"]
    tg_c = saved_creds["tg_chat_id"]

    with st.container():
        st.markdown("<div class='glass-card'><b style='color:#0f172a; font-size:1.0rem;'>🌐 07:50 모닝 글로벌 매크로 & 야간선물</b><br><small style='color:#64748b;'>미 증시, 환율, 금리 및 코스피200 야간선물 종합 분석</small></div>", unsafe_allow_html=True)
        if st.button("📢 07:50 브리핑 즉시 발송", use_container_width=True):
            if tg_t and tg_c:
                msg = NaverStockScreener.generate_0750_global_briefing()
                TelegramNotifier(tg_t, tg_c).send_message(msg)
                st.success("✅ 07:50 글로벌 매크로 브리핑 발송 완료!")
            else:
                st.warning("설정 탭에서 텔레그램 설정을 먼저 저장하세요.")

    with st.container():
        st.markdown("<div class='glass-card'><b style='color:#0f172a; font-size:1.0rem;'>⚡ 09:30 실시간 주도 테마 & 수급 TOP 10</b><br><small style='color:#64748b;'>개장 초반 1등 테마 및 (대금 500억↑ & +5%↑) 외인/기관/프로그램 순매수 주도주 10개 추출</small></div>", unsafe_allow_html=True)
        if st.button("📢 09:30 브리핑 즉시 발송", use_container_width=True):
            if tg_t and tg_c:
                msg = NaverStockScreener.generate_supply_leader_top10_briefing("09:30")
                TelegramNotifier(tg_t, tg_c).send_message(msg)
                st.success("✅ 09:30 주도 테마 & 수급 TOP 10 브리핑 발송 완료!")
            else:
                st.warning("설정 탭에서 텔레그램 설정을 먼저 저장하세요.")

    with st.container():
        st.markdown("<div class='glass-card'><b style='color:#0f172a; font-size:1.0rem;'>🔥 10:00 실시간 주도 테마 & 수급 TOP 10 (2차)</b><br><small style='color:#64748b;'>오전 수급 연속성 체크 및 (대금 500억↑ & +5%↑) 주도주 10개 재추출</small></div>", unsafe_allow_html=True)
        if st.button("📢 10:00 브리핑 즉시 발송", use_container_width=True):
            if tg_t and tg_c:
                msg = NaverStockScreener.generate_supply_leader_top10_briefing("10:00")
                TelegramNotifier(tg_t, tg_c).send_message(msg)
                st.success("✅ 10:00 주도 테마 & 수급 TOP 10 브리핑 발송 완료!")
            else:
                st.warning("설정 탭에서 텔레그램 설정을 먼저 저장하세요.")

    with st.container():
        st.markdown("<div class='glass-card'><b style='color:#0f172a; font-size:1.0rem;'>🏁 15:30 장 마감 종합 결산</b><br><small style='color:#64748b;'>당일 지수 결산, 최종 주도 테마 및 (대금 500억↑ & +5%↑) 메이저 수급주 총결산</small></div>", unsafe_allow_html=True)
        if st.button("📢 15:30 브리핑 즉시 발송", use_container_width=True):
            if tg_t and tg_c:
                msg = NaverStockScreener.generate_1530_closing_briefing()
                TelegramNotifier(tg_t, tg_c).send_message(msg)
                st.success("✅ 15:30 장 마감 결산 브리핑 발송 완료!")
            else:
                st.warning("설정 탭에서 텔레그램 설정을 먼저 저장하세요.")

# -------------------------------------------------------------
# TAB 6: 시스템 & 계정 전용 설정
# -------------------------------------------------------------
elif active_tab == "settings":
    st.markdown("#### ⚙️ 시스템 설정 및 계정 관리")
    
    with st.container():
        st.markdown(f"""
        <div class='glass-card'>
            <div style='font-size:1.05rem; font-weight:800; color:#0f172a; margin-bottom:4px;'>👤 사용자 계정 관리</div>
            <div style='font-size:0.85rem; color:#475569;'>현재 로그인 계정: <b style='color:#2563eb;'>{current_user}</b></div>
        </div>
        """, unsafe_allow_html=True)
        
        new_u = st.text_input("접속 계정 ID 변경", value=current_user)
        if st.button("🔄 계정 전환하기", use_container_width=True, type="primary"):
            if new_u.strip():
                st.session_state["current_user"] = new_u.strip()
                st.query_params["user"] = new_u.strip()
                st.toast(f"✅ '{new_u.strip()}' 계정으로 전환되었습니다!")
                st.rerun()

    saved_creds = load_user_credentials(current_user)
    with st.container():
        st.markdown(f"""
        <div class='glass-card'>
            <div style='font-size:1.05rem; font-weight:800; color:#0f172a; margin-bottom:4px;'>🔑 [{current_user}] API & 텔레그램 연동</div>
            <div style='font-size:0.85rem; color:#64748b;'>입력하신 설정값은 해당 계정에만 안전하게 개별 저장됩니다.</div>
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
