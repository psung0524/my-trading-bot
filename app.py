import streamlit as st
import json
import os
import pandas as pd
from datetime import datetime

# 모듈 불러오기
from screener import MarketScreener
from notifier import TelegramNotifier
from main import SamsungSecuritiesParser, TradeFIFOEngine, TradingMetricsAnalyzer, GeminiTradeCoach

# -------------------------------------------------------------
# 1. 모바일 맞춤 페이지 설정 및 반응형 CSS
# -------------------------------------------------------------
st.set_page_config(
    page_title="AI 트레이딩 코치",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# 모바일 가독성 극대화 CSS
st.markdown("""
<style>
    /* 상단 기본 여백 축소 */
    .block-container {
        padding-top: 1rem !important;
        padding-bottom: 2rem !important;
        padding-left: 0.8rem !important;
        padding-right: 0.8rem !important;
    }
    /* 모바일 헤더 타이틀 최적화 */
    .main-title {
        font-size: 1.35rem !important;
        font-weight: 800;
        margin-bottom: 0.5rem;
        line-height: 1.3;
    }
    /* 모바일 카드 스타일 */
    .mobile-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px 14px;
        margin-bottom: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .dark-mode-card {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 12px 14px;
        margin-bottom: 12px;
    }
    /* 지수 뱃지 */
    .index-badge {
        font-size: 0.85rem;
        font-weight: 700;
        color: #64748b;
        margin-bottom: 4px;
    }
    /* 버튼 모바일 터치 최적화 */
    .stButton button {
        width: 100% !important;
        border-radius: 8px !important;
        font-weight: 600 !important;
        padding: 0.5rem 1rem !important;
    }
    /* 데이터프레임 모바일 폰트 */
    .stDataFrame {
        font-size: 0.85rem !important;
    }
</style>
""", unsafe_allow_html=True)

# -------------------------------------------------------------
# 2. 설정 파일 관리 함수
# -------------------------------------------------------------
CONFIG_FILE = "config.json"

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    # Streamlit Secrets 호환
    return {
        "GEMINI_API_KEY": st.secrets.get("GEMINI_API_KEY", os.environ.get("GEMINI_API_KEY", "")),
        "TELEGRAM_BOT_TOKEN": st.secrets.get("TELEGRAM_BOT_TOKEN", os.environ.get("TELEGRAM_BOT_TOKEN", "")),
        "TELEGRAM_CHAT_ID": st.secrets.get("TELEGRAM_CHAT_ID", os.environ.get("TELEGRAM_CHAT_ID", ""))
    }

def save_config(cfg):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=4)

config = load_config()

# -------------------------------------------------------------
# 3. 사이드바 (모바일 설정창)
# -------------------------------------------------------------
with st.sidebar:
    st.markdown("### ⚙️ 시스템 설정")
    gemini_key = st.text_input("Gemini API Key", value=config.get("GEMINI_API_KEY", ""), type="password")
    tg_token = st.text_input("Telegram Bot Token", value=config.get("TELEGRAM_BOT_TOKEN", ""), type="password")
    tg_chat_id = st.text_input("Telegram Chat ID", value=config.get("TELEGRAM_CHAT_ID", ""))
    
    if st.button("💾 설정 영구 저장", use_container_width=True):
        config_data = {
            "GEMINI_API_KEY": gemini_key,
            "TELEGRAM_BOT_TOKEN": tg_token,
            "TELEGRAM_CHAT_ID": tg_chat_id
        }
        save_config(config_data)
        st.success("설정이 저장되었습니다.")
        
    if st.button("🔔 텔레그램 연결 테스트", use_container_width=True):
        if tg_token and tg_chat_id:
            bot = TelegramNotifier(bot_token=tg_token, chat_id=tg_chat_id)
            ok = bot.send_message("📱 모바일 트레이딩 코치 연결 테스트 완료!")
            if ok:
                st.success("메시지 발송 성공!")
            else:
                st.error("발송 실패. 토큰/Chat ID를 확인하세요.")
        else:
            st.warning("토큰과 Chat ID를 입력하세요.")

# -------------------------------------------------------------
# 4. 상단 모바일 네비게이션 및 타이틀
# -------------------------------------------------------------
st.markdown('<div class="main-title">📈 AI 트레이딩 코치 & 자율 센터</div>', unsafe_allow_html=True)

# 시장 진단 카드 (컴팩트 뷰)
screener = MarketScreener()
with st.spinner("시장 데이터 로딩 중..."):
    market_status = screener.get_market_regime()

regime_color = "#eab308" if "박스권" in market_status['regime'] else ("#22c55e" if "상승" in market_status['regime'] else "#ef4444")

st.markdown(f"""
<div style="background:#f8fafc; border-left: 4px solid {regime_color}; border-radius:8px; padding:10px 12px; margin-bottom:12px;">
    <div style="font-weight:700; font-size:1.05rem; margin-bottom:3px;">
        {market_status['regime']}
    </div>
    <div style="font-size:0.82rem; color:#64748b; margin-bottom:4px;">
        코스피: <b>{market_status['kospi_price']:,.2f}pt</b> ({market_status['kospi_change']:+.2f}%)
    </div>
    <div style="font-size:0.85rem; color:#334155; line-height:1.4;">
        💡 <b>가이드:</b> {market_status['strategy_guide']}<br>
        🎯 <b>권장 비중:</b> {market_status['recommended_portfolio']}
    </div>
</div>
""", unsafe_allow_html=True)

# 모바일 친화적 메뉴 선택기 (가로 탭 대체)
menu = st.selectbox(
    "메뉴 이동",
    [
        "👑 1. 주도 섹터 & 정배열 퀀트",
        "📢 2. 텔레그램 4대 브리핑",
        "🎯 3. 손절선 자율 감시 가디언",
        "📊 4. 매매일지 AI 복기 코칭"
    ],
    label_visibility="collapsed"
)

# -------------------------------------------------------------
# 메뉴 1: 주도 섹터 & 정배열 퀀트 스크리너
# -------------------------------------------------------------
if "1. 주도 섹터" in menu:
    st.markdown("#### 👑 완전 정배열 집중 섹터 TOP")
    
    col_btn1, col_btn2 = st.columns(2)
    with col_btn1:
        refresh = st.button("🔄 실시간 스캔", use_container_width=True)
    with col_btn2:
        scan_mode = st.selectbox("시장 선택", ["코스피 + 코스닥", "코스피", "코스닥"], label_visibility="collapsed")
        
    with st.spinner("전 종목 정배열 스크리닝 중..."):
        top_sectors = screener.get_top_aligned_sectors(limit=5)
        
    if top_sectors:
        for idx, sec in enumerate(top_sectors):
            with st.expander(f"🔥 {idx+1}위: {sec['sector_name']} ({len(sec['stocks'])}개 종목 정배열)", expanded=(idx==0)):
                for stk in sec['stocks']:
                    c1, c2, c3 = st.columns([2, 1.5, 1])
                    c1.markdown(f"**{stk['name']}**<br><span style='font-size:0.75rem; color:gray;'>{stk['code']}</span>", unsafe_allow_html=True)
                    c2.markdown(f"**{stk['price']:,}원**<br><span style='font-size:0.75rem; color:{'red' if stk['change_rate']>0 else 'blue'};'>{stk['change_rate']:+.2f}%</span>", unsafe_allow_html=True)
                    if c3.button("차트", key=f"btn_{stk['code']}"):
                        st.image(f"https://ssl.pstatic.net/imgfinance/chart/item/area/day/{stk['code']}.png", use_column_width=True)
    else:
        st.info("현재 시장에서 완전 정배열 조건을 만족하는 섹터를 집계 중입니다.")

# -------------------------------------------------------------
# 메뉴 2: 텔레그램 4대 브리핑 센터
# -------------------------------------------------------------
elif "2. 텔레그램" in menu:
    st.markdown("#### 📢 시간대별 텔레그램 브리핑")
    st.caption("스마트폰으로 원하는 시점의 시장 분석을 즉시 받아보세요.")
    
    bot_token = config.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = config.get("TELEGRAM_CHAT_ID", "")
    bot = TelegramNotifier(bot_token=bot_token, chat_id=chat_id)
    
    c1, c2 = st.columns(2)
    with c1:
        if st.button("🌅 08:00 개장전 전략", use_container_width=True):
            with st.spinner("브리핑 생성 및 전송 중..."):
                msg = screener.generate_briefing_0800()
                ok = bot.send_message(msg)
                if ok: st.success("08:00 브리핑 전송 완료!")
                else: st.error("전송 실패 (토큰 확인)")
                
        if st.button("🔔 08:50 장전 주도주", use_container_width=True):
            with st.spinner("브리핑 생성 및 전송 중..."):
                msg = screener.generate_briefing_0850()
                ok = bot.send_message(msg)
                if ok: st.success("08:50 브리핑 전송 완료!")
                else: st.error("전송 실패 (토큰 확인)")
                
    with c2:
        if st.button("🚀 09:30 거래대금 폭발", use_container_width=True):
            with st.spinner("브리핑 생성 및 전송 중..."):
                msg = screener.generate_briefing_0930()
                ok = bot.send_message(msg)
                if ok: st.success("09:30 브리핑 전송 완료!")
                else: st.error("전송 실패 (토큰 확인)")
                
        if st.button("🎯 10:00 오전장 확정", use_container_width=True):
            with st.spinner("브리핑 생성 및 전송 중..."):
                msg = screener.generate_briefing_1000()
                ok = bot.send_message(msg)
                if ok: st.success("10:00 브리핑 전송 완료!")
                else: st.error("전송 실패 (토큰 확인)")

# -------------------------------------------------------------
# 메뉴 3: 손절선 자율 감시 가디언
# -------------------------------------------------------------
elif "3. 손절선" in menu:
    st.markdown("#### 🎯 실시간 손절선 가디언")
    
    WATCHLIST_FILE = "watchlist.json"
    def load_watchlist():
        if os.path.exists(WATCHLIST_FILE):
            try:
                with open(WATCHLIST_FILE, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return []
        return []

    def save_watchlist(wl):
        with open(WATCHLIST_FILE, "w", encoding="utf-8") as f:
            json.dump(wl, f, ensure_ascii=False, indent=4)

    watchlist = load_watchlist()

    # 등록 폼 (모바일 맞춤 1열/2열 구성)
    with st.expander("➕ 감시 종목 추가하기", expanded=True):
        stk_name = st.text_input("종목명", placeholder="예: 삼성전자")
        stk_code = st.text_input("종목코드 (6자리)", placeholder="예: 005930")
        c1, c2 = st.columns(2)
        with c1:
            buy_price = st.number_input("매수가(원)", value=0, step=500)
        with c2:
            stop_price = st.number_input("손절선(원)", value=0, step=500)
            
        if st.button("가디언 감시 등록", use_container_width=True):
            if stk_name and stk_code and stop_price > 0:
                watchlist.append({
                    "name": stk_name,
                    "code": stk_code,
                    "buy_price": buy_price,
                    "stop_loss": stop_price,
                    "reg_date": datetime.now().strftime("%m-%d %H:%M")
                })
                save_watchlist(watchlist)
                st.success(f"[{stk_name}] 감시 등록 완료!")
                st.rerun()
            else:
                st.warning("종목명, 코드, 손절가를 모두 입력해주세요.")

    if watchlist:
        st.markdown(f"**현재 감시 중인 종목 ({len(watchlist)}개)**")
        for i, item in enumerate(watchlist):
            c1, c2 = st.columns([3, 1])
            c1.markdown(f"**{item['name']}** ({item['code']})<br>매수가: {item['buy_price']:,}원 | <span style='color:red;'>손절가: {item['stop_loss']:,}원</span>", unsafe_allow_html=True)
            if c2.button("삭제", key=f"del_{i}", use_container_width=True):
                watchlist.pop(i)
                save_watchlist(watchlist)
                st.rerun()
    else:
        st.info("등록된 감시 종목이 없습니다.")

# -------------------------------------------------------------
# 메뉴 4: 매매일지 AI 복기 코칭
# -------------------------------------------------------------
elif "4. 매매일지" in menu:
    st.markdown("#### 📊 삼성증권 매매일지 AI 코칭")
    
    uploaded_file = st.file_uploader("삼성증권 거래내역 엑셀(.xlsx) 업로드", type=["xlsx", "xls"])
    
    if uploaded_file:
        try:
            parser = SamsungSecuritiesParser(uploaded_file)
            raw_trades = parser.parse()
            engine = TradeFIFOEngine()
            completed_trades = engine.process(raw_trades)
            analyzer = TradingMetricsAnalyzer(completed_trades)
            metrics = analyzer.calculate()
            
            c1, c2 = st.columns(2)
            c1.metric("총 실현손익", f"{metrics['total_pnl']:,}원")
            c2.metric("승률", f"{metrics['win_rate']:.1f}%")
            
            if st.button("🤖 Gemini AI 복기 진단 받기", use_container_width=True):
                g_key = config.get("GEMINI_API_KEY", "")
                if g_key:
                    with st.spinner("AI가 매매 패턴을 정밀 분석 중입니다..."):
                        coach = GeminiTradeCoach(api_key=g_key)
                        feedback = coach.generate_feedback(metrics)
                        st.markdown("---")
                        st.markdown(feedback)
                else:
                    st.warning("사이드바에서 Gemini API 키를 먼저 입력해주세요.")
        except Exception as e:
            st.error(f"엑셀 분석 중 오류: {str(e)}")
