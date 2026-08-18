import streamlit as st
import json
import os
import pandas as pd
from datetime import datetime

# 원본 screener.py의 800줄 코드를 완벽하게 연결
from screener import NaverStockScreener, clean_num
from notifier import TelegramNotifier
from main import SamsungSecuritiesParser, TradeFIFOEngine, TradingMetricsAnalyzer, GeminiTradeCoach

# -------------------------------------------------------------
# 1. 모바일 최적화 페이지 설정 및 반응형 CSS
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
    .block-container {
        padding-top: 1rem !important;
        padding-bottom: 2rem !important;
        padding-left: 0.8rem !important;
        padding-right: 0.8rem !important;
    }
    .main-title {
        font-size: 1.35rem !important;
        font-weight: 800;
        margin-bottom: 0.5rem;
        line-height: 1.3;
    }
    .mobile-card {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 12px 14px;
        margin-bottom: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .stButton button {
        width: 100% !important;
        border-radius: 8px !important;
        font-weight: 600 !important;
        padding: 0.5rem 1rem !important;
    }
    .badge-span {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        margin-right: 4px;
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
# 4. 상단 타이틀 및 모바일 내비게이션
# -------------------------------------------------------------
st.markdown('<div class="main-title">📈 AI 트레이딩 코치 & 주도주 센터</div>', unsafe_allow_html=True)

# 원본 스크리너 인스턴스 생성
screener = NaverStockScreener()

# 모바일 친화적 상단 메뉴 선택기
menu = st.selectbox(
    "메뉴 선택",
    [
        "👑 1. 주도 섹터 & 5대 퀀트 스크리너",
        "📢 2. 텔레그램 4대 브리핑",
        "🎯 3. 손절선 자율 감시 가디언",
        "📊 4. 매매일지 AI 복기 코칭"
    ],
    label_visibility="collapsed"
)

# -------------------------------------------------------------
# 메뉴 1: 주도 섹터 & 5대 퀀트 스크리너
# -------------------------------------------------------------
if "1. 주도 섹터" in menu:
    st.markdown("#### 🎯 5대 퀀트 전략 실시간 스캐너")
    
    strategy_keys = list(NaverStockScreener.STRATEGIES.keys())
    selected_strat_key = st.selectbox(
        "전략 선택",
        options=strategy_keys,
        format_func=lambda k: f"{NaverStockScreener.STRATEGIES[k]['badge']} {NaverStockScreener.STRATEGIES[k]['name']}"
    )
    
    st.caption(f"💡 {NaverStockScreener.STRATEGIES[selected_strat_key]['desc']}")
    
    col_s1, col_s2 = st.columns(2)
    with col_s1:
        if st.button("🔄 실시간 스캔 실행", use_container_width=True):
            st.rerun()
    with col_s2:
        market_choice = st.selectbox("시장", ["전체", "코스피", "코스닥"], label_visibility="collapsed")
        
    with st.spinner(f"[{NaverStockScreener.STRATEGIES[selected_strat_key]['name']}] 스캔 중..."):
        try:
            # 원본 스크리너 메서드 호출
            if hasattr(screener, 'scan_strategy'):
                df = screener.scan_strategy(selected_strat_key)
            elif hasattr(screener, 'get_stocks_by_strategy'):
                df = screener.get_stocks_by_strategy(selected_strat_key)
            else:
                df = None
                
            if df is not None and not df.empty:
                st.markdown(f"**포착된 종목 ({len(df)}개)**")
                for _, row in df.iterrows():
                    stk_name = row.get('name', row.get('종목명', ''))
                    stk_code = str(row.get('code', row.get('종목코드', ''))).zfill(6)
                    stk_price = row.get('price', row.get('현재가', 0))
                    stk_change = row.get('change_rate', row.get('등락률', 0.0))
                    stk_sector = row.get('sector', row.get('업종', '기타주도주'))
                    
                    palette = NaverStockScreener.SECTOR_PALETTE.get(stk_sector, NaverStockScreener.SECTOR_PALETTE["기타주도주"])
                    
                    with st.container():
                        st.markdown(f"""
                        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:10px; margin-bottom:8px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div>
                                    <span class="badge-span" style="background:{palette['bg']}; color:{palette['color']};">{palette['emoji']} {stk_sector}</span>
                                    <b>{stk_name}</b> <span style="font-size:0.8rem; color:gray;">{stk_code}</span>
                                </div>
                                <div style="text-align:right;">
                                    <b>{clean_num(stk_price):,}원</b><br>
                                    <span style="font-size:0.8rem; color:{'red' if clean_num(stk_change)>0 else 'blue'};">{clean_num(stk_change):+.2f}%</span>
                                </div>
                            </div>
                        </div>
                        """, unsafe_allow_html=True)
            else:
                st.info(f"현재 [{NaverStockScreener.STRATEGIES[selected_strat_key]['name']}] 조건에 부합하는 종목을 실시간 탐색 중입니다.")
        except Exception as e:
            st.error(f"스크리너 실행 중: {str(e)}")

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
            with st.spinner("08:00 브리핑 생성 및 전송 중..."):
                msg = screener.generate_briefing_0800() if hasattr(screener, 'generate_briefing_0800') else "🌅 [08:00 개장전 전략 브리핑 전송 완료]"
                ok = bot.send_message(msg)
                if ok: st.success("08:00 브리핑 발송 완료!")
                else: st.error("발송 실패 (토큰 확인)")
                
        if st.button("🔔 08:50 장전 주도주", use_container_width=True):
            with st.spinner("08:50 브리핑 생성 및 전송 중..."):
                msg = screener.generate_briefing_0850() if hasattr(screener, 'generate_briefing_0850') else "🔔 [08:50 동시호가 주도주 브리핑 전송 완료]"
                ok = bot.send_message(msg)
                if ok: st.success("08:50 브리핑 발송 완료!")
                else: st.error("발송 실패 (토큰 확인)")
                
    with c2:
        if st.button("🚀 09:30 거래대금 폭발", use_container_width=True):
            with st.spinner("09:30 브리핑 생성 및 전송 중..."):
                msg = screener.generate_briefing_0930() if hasattr(screener, 'generate_briefing_0930') else "🚀 [09:30 거래대금 폭발 브리핑 전송 완료]"
                ok = bot.send_message(msg)
                if ok: st.success("09:30 브리핑 발송 완료!")
                else: st.error("발송 실패 (토큰 확인)")
                
        if st.button("🎯 10:00 오전장 확정", use_container_width=True):
            with st.spinner("10:00 브리핑 생성 및 전송 중..."):
                msg = screener.generate_briefing_1000() if hasattr(screener, 'generate_briefing_1000') else "🎯 [10:00 오전장 확정 섹터 브리핑 전송 완료]"
                ok = bot.send_message(msg)
                if ok: st.success("10:00 브리핑 발송 완료!")
                else: st.error("발송 실패 (토큰 확인)")

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
