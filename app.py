import streamlit as st
import pandas as pd
import json
import os
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from google import genai

from main import SamsungSecuritiesParser, TradeFIFOEngine, TradingMetricsAnalyzer, get_best_available_model
from screener import NaverStockScreener
from notifier import TelegramNotifier

CONFIG_FILE = Path(__file__).parent / "config.json"
ENV_FILE = Path(__file__).parent / ".env"
WATCHLIST_FILE = "watchlist.json"

load_dotenv(dotenv_path=ENV_FILE, override=True)

# -------------------------------------------------------------
# 1. 모바일 앱 전용 고정 하단 내비게이션 완벽 CSS
# -------------------------------------------------------------
st.set_page_config(
    page_title="AI 트레이딩 코치",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
<style>
    /* 하단 고정 바가 본문 콘텐츠를 가리지 않도록 하단 여백 확보 */
    .block-container {
        padding-top: 0.6rem !important;
        padding-bottom: 95px !important;
        padding-left: 0.6rem !important;
        padding-right: 0.6rem !important;
    }
    
    .mobile-header-title {
        font-size: 1.2rem !important;
        font-weight: 800;
        margin-bottom: 0.3rem;
    }
    
    .badge-span {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: bold;
        margin-right: 3px;
        margin-bottom: 2px;
    }
    
    /* 🚀 하단 플로팅 네비게이션 바 완벽 고정 스타일 (모든 버전 호환) */
    div[data-testid="stBottom"],
    footer,
    .stApp > div:has(div[data-testid="stBottomBlockContainer"]),
    div[data-testid="stBottomBlockContainer"] {
        position: fixed !important;
        bottom: 0 !important;
        left: 0 !important;
        right: 0 !important;
        width: 100vw !important;
        background-color: #ffffff !important;
        border-top: 1.5px solid #e2e8f0 !important;
        padding: 6px 6px 10px 6px !important;
        z-index: 9999999 !important;
        box-shadow: 0 -4px 15px rgba(0,0,0,0.1) !important;
        margin: 0 !important;
    }
    
    /* 하단 버튼 앱 전용 스타일 */
    div[data-testid="stBottomBlockContainer"] button,
    div[data-testid="stBottom"] button {
        height: 48px !important;
        padding: 2px 0px !important;
        line-height: 1.2 !important;
        font-size: 0.72rem !important;
        font-weight: 700 !important;
        border-radius: 8px !important;
    }
</style>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# 2. 헬퍼 함수 및 설정 로드
# -------------------------------------------------------------
def load_saved_credentials():
    creds = {
        "gemini_api_key": os.getenv("GEMINI_API_KEY", ""),
        "tg_token": os.getenv("TELEGRAM_BOT_TOKEN", ""),
        "tg_chat_id": os.getenv("TELEGRAM_CHAT_ID", "")
    }
    try:
        creds["gemini_api_key"] = st.secrets.get("GEMINI_API_KEY", creds["gemini_api_key"])
        creds["tg_token"] = st.secrets.get("TELEGRAM_BOT_TOKEN", creds["tg_token"])
        creds["tg_chat_id"] = st.secrets.get("TELEGRAM_CHAT_ID", creds["tg_chat_id"])
    except Exception:
        pass

    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                creds["gemini_api_key"] = data.get("gemini_api_key") or creds["gemini_api_key"]
                creds["tg_token"] = data.get("tg_token") or creds["tg_token"]
                creds["tg_chat_id"] = data.get("tg_chat_id") or creds["tg_chat_id"]
        except Exception:
            pass
    return creds

def get_saved_watchlist():
    if not os.path.exists(WATCHLIST_FILE):
        with open(WATCHLIST_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)
        return []
    try:
        with open(WATCHLIST_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_watchlist(watchlist):
    with open(WATCHLIST_FILE, "w", encoding="utf-8") as f:
        json.dump(watchlist, f, ensure_ascii=False, indent=2)

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
    is_golden = row['전략수'] >= 2

    border_style = "border: 1.5px solid #f59f00; background-color: rgba(245, 159, 0, 0.03);" if is_golden else "border: 1px solid rgba(128, 128, 128, 0.2);"
    golden_badge = f"<span class='badge-span' style='background-color:#f59f00; color:#000;'>🔥 {row['전략수']}개 다중일치</span> " if is_golden else ""

    strat_badges = ""
    for s_code in row['매칭전략']:
        info = NaverStockScreener.STRATEGIES.get(s_code, {})
        strat_badges += f"<span class='badge-span' style='background-color:#333; color:#fff;'>{info.get('badge', s_code)}</span>"

    sec = row.get('섹터정보', {})
    sec_cat = sec.get('category', '주도주')
    raw_ind = sec.get('raw_industry', sec_cat)
    sec_emoji = sec.get('emoji', '🔥')
    sec_bg = sec.get('bg', '#374151')
    sec_color = sec.get('color', '#f3f4f6')
    
    tag_label = f"{sec_emoji} {sec_cat}" if sec_cat == raw_ind else f"{sec_emoji} {sec_cat} ({raw_ind})"
    theme_chip = f"<span class='badge-span' style='background-color:{sec_bg}; color:{sec_color};'>{tag_label}</span>"

    st.markdown(f"""
    <div style='padding: 10px 12px; border-radius: 8px; {border_style} margin-bottom: 6px;'>
        <div style='display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;'>
            <div>
                {golden_badge}<strong>{row['종목명']}</strong> <small style='color:#888;'>{row['종목코드']}</small><br>
                {theme_chip}
            </div>
            <div style='text-align:right;'>{strat_badges}</div>
        </div>
        <div style='margin-top: 4px; font-size: 13px;'>
            <strong>{curr_p:,}원</strong> <span style='color:#e03131; font-weight:bold;'>+{row['등락률(%)']}%</span> &nbsp;|&nbsp; 대금 <strong>{formatted_money}</strong>
        </div>
        <div style='margin-top: 4px; font-size: 11.5px; color: #888;'>
            🛑 손절: <strong style='color:#ff8787;'>{calc_stop:,}원 (-{default_stop_pct}%)</strong> &nbsp;|&nbsp; 
            🎯 3R: <strong style='color:#69db7c;'>{calc_tp_3r:,}원 (+{take_profit_3r_pct}%)</strong>
        </div>
    </div>
    """, unsafe_allow_html=True)

    c_chart, c_act = st.columns([1, 1])
    with c_chart:
        if st.button("📈 차트보기", key=f"chart_{tab_prefix}_{row['종목코드']}_{row.name}", use_container_width=True):
            show_chart_modal(row['종목코드'], row['종목명'])
    with c_act:
        unique_btn_key = f"btn_{tab_prefix}_{row['종목코드']}_{row.name}"
        if st.button("➕ 감시 등록", key=unique_btn_key, use_container_width=True, type="primary"):
            current_list = get_saved_watchlist()
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
                "theme": f"{sec_emoji} {sec_cat}",
                "strategy": ",".join(row['매칭전략']),
                "added_at": datetime.now().strftime("%Y-%m-%d %H:%M")
            })
            save_watchlist(current_list)
            st.toast(f"✅ [{row['종목명']}] 감시 등록 완료!")

# -------------------------------------------------------------
# 3. 사이드바 (시스템 설정)
# -------------------------------------------------------------
saved_creds = load_saved_credentials()

with st.sidebar:
    st.header("⚙️ 시스템 설정")
    api_key = st.text_input("Gemini API Key", type="password", value=saved_creds["gemini_api_key"])
    
    st.divider()
    st.header("📲 텔레그램 가디언 설정")
    tg_token = st.text_input("Bot Token", type="password", value=saved_creds["tg_token"])
    tg_chat_id = st.text_input("My Chat ID", value=saved_creds["tg_chat_id"])
    
    col_save, col_test = st.columns([1, 1])
    with col_save:
        if st.button("💾 영구 저장", use_container_width=True, type="primary"):
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "gemini_api_key": api_key.strip(),
                    "tg_token": tg_token.strip(),
                    "tg_chat_id": tg_chat_id.strip()
                }, f, ensure_ascii=False, indent=2)
            st.toast("✅ 설정값이 영구 저장되었습니다!")
            st.rerun()

    with col_test:
        if st.button("🔔 연결 테스트", use_container_width=True):
            if tg_token and tg_chat_id:
                notifier = TelegramNotifier(tg_token, tg_chat_id)
                if notifier.send_message("✅ *AI 트레이딩 가디언과 텔레그램이 완벽히 연동되었습니다.*"):
                    st.success("발송 성공!")
                else:
                    st.error("토큰/ID를 확인하세요.")
            else:
                st.warning("토큰과 ID를 입력하세요.")

# -------------------------------------------------------------
# 4. 상단 헤더 & 모바일 지수 대시보드
# -------------------------------------------------------------
st.markdown('<div class="mobile-header-title">📈 AI 트레이딩 코치 & 주도주 센터</div>', unsafe_allow_html=True)

market_regime = NaverStockScreener.get_market_regime()
safe_alloc = market_regime.get('alloc_guide', '주식 50% / 현금 50%').replace("~~", " ~ ").replace("~", "～")

kospi_pt = str(market_regime.get('kospi_close', '2,650.00'))
kospi_chg = str(market_regime.get('kospi_change_pct', '0.0'))
kospi_color = "#e03131" if not kospi_chg.startswith("-") and kospi_chg != "0.0" else ("#1971c2" if kospi_chg.startswith("-") else "#333333")

kosdaq_pt = str(market_regime.get('kosdaq_close', '860.50'))
kosdaq_chg = str(market_regime.get('kosdaq_change_pct', '-0.85'))
kosdaq_color = "#e03131" if not kosdaq_chg.startswith("-") and kosdaq_chg != "0.0" else ("#1971c2" if kosdaq_chg.startswith("-") else "#333333")

with st.container(border=True):
    st.markdown(f"<div style='font-size: 1.0rem; font-weight: 800; margin-bottom: 5px;'>{market_regime['badge']}</div>", unsafe_allow_html=True)
    
    col_idx1, col_idx2 = st.columns(2)
    with col_idx1:
        st.markdown(f"""
        <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 8px; text-align: center;'>
            <div style='font-size: 0.72rem; color: #64748b; font-weight: bold;'>KOSPI 코스피</div>
            <div style='font-size: 1.05rem; font-weight: 800; color: {kospi_color};'>{kospi_pt} <span style='font-size: 0.78rem;'>({kospi_chg}%)</span></div>
        </div>
        """, unsafe_allow_html=True)
    with col_idx2:
        st.markdown(f"""
        <div style='background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 5px 8px; text-align: center;'>
            <div style='font-size: 0.72rem; color: #64748b; font-weight: bold;'>KOSDAQ 코스닥</div>
            <div style='font-size: 1.05rem; font-weight: 800; color: {kosdaq_color};'>{kosdaq_pt} <span style='font-size: 0.78rem;'>({kosdaq_chg}%)</span></div>
        </div>
        """, unsafe_allow_html=True)
        
    st.markdown("<div style='height: 4px;'></div>", unsafe_allow_html=True)
    st.markdown(f"💡 <span style='font-size:0.82rem;'><b>가이드:</b> {market_regime['desc']}</span>", unsafe_allow_html=True)
    st.markdown(f"🎯 <span style='font-size:0.82rem;'><b>권장 비중:</b> <span style='background:#ecfdf5; color:#047857; font-weight:bold; padding:2px 6px; border-radius:4px;'>{safe_alloc}</span></span>", unsafe_allow_html=True)

# -------------------------------------------------------------
# 5. 활성 탭 상태 관리
# -------------------------------------------------------------
if "active_nav_tab" not in st.session_state:
    st.session_state["active_nav_tab"] = "screener"

active_tab = st.session_state["active_nav_tab"]

# -------------------------------------------------------------
# TAB 1: 퀀트 스크리너
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
        st.markdown("**⚡ 실시간 급등 테마 TOP**")
        for i, theme in enumerate(top_themes[:4]):
            t_name = theme['theme_name']
            is_active = st.session_state["selected_theme_filter"] == t_name
            btn_style = "primary" if is_active else "secondary"
            c_t1, c_t2 = st.columns([3, 1])
            c_t1.markdown(f"**{t_name}** <span style='color:#e03131; font-weight:bold;'>+{theme['change_rate']}%</span> (대장: {theme['leader']})", unsafe_allow_html=True)
            if c_t2.button(f"{'해제' if is_active else '필터'}", key=f"theme_btn_{i}", use_container_width=True, type=btn_style):
                st.session_state["selected_theme_filter"] = None if is_active else t_name
                st.rerun()

    st.divider()
    active_theme = st.session_state.get("selected_theme_filter")
    if active_theme:
        target_theme_data = next((t for t in top_themes if t["theme_name"] == active_theme), None)
        member_names = target_theme_data["member_stocks"] if target_theme_data else []
        filtered_df = all_df[all_df["종목명"].isin(member_names)]
        
        c_head, c_clear = st.columns([3, 1])
        c_head.markdown(f"##### 🎯 [{active_theme}] 주도주 ({len(filtered_df)}종목)")
        if c_clear.button("❌ 초기화", use_container_width=True):
            st.session_state["selected_theme_filter"] = None
            st.rerun()

        if not filtered_df.empty:
            for _, r in filtered_df.iterrows():
                render_stock_card(r, default_stop_pct, tab_prefix="theme_filtered")
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
    st.markdown("#### 📡 실시간 감시 포트폴리오 & 리스크")
    current_list = get_saved_watchlist()
    if not current_list:
        st.info("현재 감시 중인 종목이 없습니다. 퀀트 스크리너에서 유망 종목을 등록하세요.")
    else:
        for item in current_list:
            buy_p = item['buy_price']
            curr_p = item.get('current_price', buy_p)
            pnl_pct = item.get('pnl_pct', 0.0)
            stop_p = item['stop_price']
            tp_p = item.get('tp_price', int(buy_p * 1.18))

            if curr_p <= stop_p:
                status_badge = "🛑 <b style='color:#ff8787;'>[손절 발동]</b>"
            elif curr_p <= stop_p * 1.015:
                status_badge = "⚠️ <b style='color:#f59f00;'>[손절 주의]</b>"
            elif pnl_pct > 0:
                status_badge = "🟢 <b style='color:#69db7c;'>[수익 순항]</b>"
            else:
                status_badge = "🔵 [보통]"

            with st.container(border=True):
                c1, c2 = st.columns([3, 2])
                with c1:
                    st.markdown(f"**{item['name']}** <small style='color:#888;'>({item['code']})</small>", unsafe_allow_html=True)
                    st.caption(f"매수: {buy_p:,}원 ➡️ 현재: **{curr_p:,}원**")
                with c2:
                    pnl_color = "#e03131" if pnl_pct > 0 else "#1971c2"
                    st.markdown(f"<span style='font-size:16px; font-weight:bold; color:{pnl_color};'>{pnl_pct:+0.2f}%</span> {status_badge}", unsafe_allow_html=True)
                
                c3, c4 = st.columns([3, 1])
                with c3:
                    st.caption(f"🛑 손절: `{stop_p:,}원` | 🎯 3R: `{tp_p:,}원`")
                with c4:
                    if st.button("삭제", key=f"del_{item['code']}", use_container_width=True):
                        current_list = [s for s in current_list if s["code"] != item["code"]]
                        save_watchlist(current_list)
                        st.toast(f"{item['name']} 삭제 완료")
                        st.rerun()

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
    st.markdown("#### 📢 시간대별 4대 텔레그램 브리핑 센터")
    st.caption("버튼을 누르면 정밀 수급 분석 브리핑이 스마트폰 텔레그램으로 즉시 발송됩니다.")

    tg_t = saved_creds["tg_token"]
    tg_c = saved_creds["tg_chat_id"]

    c_b1, c_b2 = st.columns(2)
    with c_b1:
        with st.container(border=True):
            st.markdown("##### 🌐 08:00 글로벌 매크로")
            if st.button("📢 08:00 발송", use_container_width=True):
                if tg_t and tg_c:
                    with st.spinner("08:00 브리핑 생성 중..."):
                        msg = NaverStockScreener.generate_0800_global_briefing()
                        TelegramNotifier(tg_t, tg_c).send_message(msg)
                        st.success("발송 완료!")
                        st.markdown(msg)
                else:
                    st.warning("사이드바에서 텔레그램 설정을 먼저 저장하세요.")

        with st.container(border=True):
            st.markdown("##### ⚡ 09:30 장초반 주도섹터")
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
        with st.container(border=True):
            st.markdown("##### 🌅 08:50 프리마켓&골든픽")
            if st.button("📢 08:50 발송", use_container_width=True):
                if tg_t and tg_c:
                    with st.spinner("08:50 브리핑 생성 중..."):
                        msg = NaverStockScreener.generate_0850_nxt_briefing()
                        TelegramNotifier(tg_t, tg_c).send_message(msg)
                        st.success("발송 완료!")
                        st.markdown(msg)
                else:
                    st.warning("사이드바에서 텔레그램 설정을 먼저 저장하세요.")

        with st.container(border=True):
            st.markdown("##### 🔥 10:00 장중 확정 주도주")
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
    st.markdown("#### 📊 삼성증권 매매복기 & AI 진단")
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

# -------------------------------------------------------------
# 6. Streamlit 공식 st.bottom() 컨테이너로 완전 고정
# -------------------------------------------------------------
try:
    bottom_nav = st.bottom()
except AttributeError:
    bottom_nav = st.container()

with bottom_nav:
    b_col1, b_col2, b_col3, b_col4, b_col5 = st.columns(5)
    with b_col1:
        if st.button("🎯\n스크리너", key="nav_btn_screener", use_container_width=True, type="primary" if active_tab=="screener" else "secondary"):
            st.session_state["active_nav_tab"] = "screener"
            st.rerun()
    with b_col2:
        if st.button("📡\n포트", key="nav_btn_monitor", use_container_width=True, type="primary" if active_tab=="monitor" else "secondary"):
            st.session_state["active_nav_tab"] = "monitor"
            st.rerun()
    with b_col3:
        if st.button("🔬\n백테스트", key="nav_btn_backtest", use_container_width=True, type="primary" if active_tab=="backtest" else "secondary"):
            st.session_state["active_nav_tab"] = "backtest"
            st.rerun()
    with b_col4:
        if st.button("📢\n브리핑", key="nav_btn_briefing", use_container_width=True, type="primary" if active_tab=="briefing" else "secondary"):
            st.session_state["active_nav_tab"] = "briefing"
            st.rerun()
    with b_col5:
        if st.button("🧠\n복기", key="nav_btn_report", use_container_width=True, type="primary" if active_tab=="report" else "secondary"):
            st.session_state["active_nav_tab"] = "report"
            st.rerun()
