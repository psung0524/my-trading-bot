from __future__ import annotations
from datetime import datetime
import pandas as pd
import streamlit as st
from alpha_investor.backtest import performance_metrics
from alpha_investor.data_provider import SampleProvider
from alpha_investor.market import classify_market
from alpha_investor.repository import Repository
from alpha_investor.scoring import alpha_score, build_trade_plan
from alpha_investor.config import settings
from alpha_investor.kis_provider import KisConfigurationError, KisMarketProvider
from alpha_investor.market_intelligence import leader_groups, new_high_candidates, sample_market_rows
from alpha_investor.strategy_engine import CORE_SECTOR_KEYWORDS, exit_plan
from alpha_investor.free_korea_provider import FreeDataUnavailable, FreeKoreaProvider

st.set_page_config(page_title="Alpha Desk", page_icon="◈", layout="wide", initial_sidebar_state="expanded")
st.markdown("""<style>
.block-container{max-width:1440px;padding-top:1.5rem}.hero{padding:20px 24px;border:1px solid #30415b;background:linear-gradient(100deg,#101b2e,#143545);border-radius:15px;margin-bottom:18px}.eyebrow{color:#7dd3fc;font-size:.78rem;font-weight:700;letter-spacing:.11em}.decision{font-size:1.22rem;font-weight:700;margin:.2rem 0}.muted{color:#aebdd0;font-size:.91rem}.risk{border-left:4px solid #f59e0b;padding:.6rem .9rem;background:#332712;border-radius:5px}</style>""", unsafe_allow_html=True)
provider,repo=SampleProvider(),Repository(); snapshots=provider.snapshots(); regime=classify_market(provider.index_history()); scores={s.code:alpha_score(s,1) for s in snapshots}
market_rows=sample_market_rows()

@st.cache_data(ttl=settings.market_refresh_seconds, show_spinner=False)
def current_indices():
    try:
        quotes=KisMarketProvider().major_indices()
        return quotes, 'live'
    except Exception as exc:
        try:
            return FreeKoreaProvider().daily_indices(), 'eod'
        except Exception as fallback_exc:
            # No estimate is ever labelled live: the UI exposes the integration state.
            return [], f'{exc} / 대체 데이터: {fallback_exc}'

with st.sidebar:
    st.title("◈ ALPHA DESK"); st.caption("결정 지원 · 리스크 관리")
    page=st.radio("주 메뉴",["오늘의 브리핑","후보 발굴","전략 룰","매매 계획","내 포트폴리오","검증·일지","아침 브리핑","연동·운영"],label_visibility="collapsed")
    st.divider(); st.caption("데이터 상태"); st.warning("현재: 데모 데이터",icon="⚠️"); st.caption("실서비스 전 공식 시세·공시·수급 공급자 연결이 필요합니다.")
    st.divider(); st.caption("투자 조언이 아닌 정보·리스크 관리 도구입니다.")

def won(v): return f"₩{v:,.0f}"
def header(title,caption=""):
    st.subheader(title)
    if caption: st.caption(caption)

if page=="오늘의 브리핑":
    indices,index_error=current_indices()
    st.markdown(f"<div class='hero'><div class='eyebrow'>TODAY'S DECISION BRIEF · {datetime.now():%Y-%m-%d %H:%M}</div><div class='decision'>{regime.label} — {regime.action}</div><div class='muted'>{' · '.join(regime.reasons)}</div></div>",unsafe_allow_html=True)
    if indices:
        a,b,c,d=st.columns(4)
        for col,q in zip([a,b],indices): col.metric(q.name,f"{q.value:,.2f}",f"{q.change:+.2f} · {q.change_pct:+.2f}%")
        c.metric("시장 체력",f"{regime.score}/100","추세·모멘텀"); d.metric("시세 기준",indices[0].as_of,indices[0].source)
        if index_error == 'eod': st.warning('현재는 무키 대체 경로의 일봉 데이터입니다. 장중 실시간 시세 또는 매매 판단용으로 사용하지 마세요.')
    else:
        a,b,c,d=st.columns(4); a.metric("시장 체력",f"{regime.score}/100","추세·모멘텀"); b.metric("오늘 검토 후보",sum(x.total>=65 for x in scores.values()),"데모 데이터"); c.metric("보유 위험 알림","0건","데모 기준"); d.metric("실시간 연동","미설정","KIS API 키 필요")
        st.info("실시간 KOSPI/KOSDAQ는 KIS Open API 키를 `.env`에 설정하면 표시됩니다. 지금은 지수 값을 임의로 표시하지 않습니다.")
    left,right=st.columns([1.55,1])
    with left:
        header("우선순위 후보","점수는 매수 신호가 아니라 검토 순서를 정하는 설명 가능한 필터입니다.")
        rows=[]
        for s in sorted(snapshots,key=lambda x:scores[x.code].total,reverse=True):
            r=scores[s.code]; rows.append({"종목":s.name,"Alpha":r.total,"상태":r.grade,"현재가":won(s.price),"등락":f"{s.change_pct:+.1f}%","검토 근거":" · ".join(r.reasons[:2]),"다음 행동":"진입조건 확인" if r.total>=75 else "관찰 유지"})
        st.dataframe(pd.DataFrame(rows),hide_index=True,width="stretch",column_config={"Alpha":st.column_config.ProgressColumn("Alpha",min_value=0,max_value=100,format="%d")})
    with right:
        header("오늘의 실행 규칙"); st.markdown("<div class='risk'><b>지금 필요한 것은 종목 추가가 아니라 계획 확인입니다.</b><br>장중 급등·알림만으로 진입하지 말고, 진입가·무효화·최대 손실을 먼저 확정하세요.</div>",unsafe_allow_html=True)
        st.markdown("**체크 순서**\n\n1. 시장 국면이 전략과 맞는가  \n2. 진입 조건이 종가 기준으로 유지되는가  \n3. 손절 시 계좌 전체 손실이 허용 범위인가  \n4. 공시·실적 일정 같은 이벤트 위험은 없는가")
        st.markdown("**알림 원칙**"); st.caption("가격 도달, 손절 이탈, 1R/3R 도달, 투자 논리 이벤트만 보냅니다. ‘놓칠까 봐’ 보내는 알림은 줄입니다.")
    st.divider()
    themes=leader_groups(market_rows,'theme'); sectors=leader_groups(market_rows,'sector')
    l,r=st.columns(2)
    with l:
        header("오늘의 주도 테마","거래대금·가중 수익률·외국인/기관/프로그램 순매수의 결합 순위입니다. 현재는 데모 표본입니다.")
        frame=pd.DataFrame([{'테마':x['name'],'등락률':f"{x['return_pct']:+.2f}%",'거래대금':f"{x['trading_value']/1e12:.2f}조",'수급 합계':f"{(x['foreign_net_buy']+x['institution_net_buy']+x['program_net_buy'])/1e9:+.0f}억",'핵심 종목':', '.join(s.name for s in x['stocks'][:2])} for x in themes])
        st.dataframe(frame,hide_index=True,width="stretch")
    with r:
        header("오늘의 주도 섹터","테마의 개별 뉴스성 급등과 업종 전체 확산을 구분합니다.")
        frame=pd.DataFrame([{'섹터':x['name'],'등락률':f"{x['return_pct']:+.2f}%",'거래대금':f"{x['trading_value']/1e12:.2f}조",'구성 종목':x['members'],'핵심 종목':', '.join(s.name for s in x['stocks'][:2])} for x in sectors])
        st.dataframe(frame,hide_index=True,width="stretch")
    header("수급 주도주 · 52주 신고가 근접","수급은 장중 추정치와 장마감 확정치를 구분해 표시해야 하며, 단독 매수 주체만으로 매수를 결정하지 않습니다.")
    flow=sorted(market_rows,key=lambda x:(x.foreign_net_buy or 0)+(x.institution_net_buy or 0)+(x.program_net_buy or 0),reverse=True)[:5]
    high=new_high_candidates(market_rows)
    l,r=st.columns(2)
    with l: st.dataframe(pd.DataFrame([{'종목':x.name,'테마':x.theme,'외국인+기관+프로그램':f"{((x.foreign_net_buy or 0)+(x.institution_net_buy or 0)+(x.program_net_buy or 0))/1e9:+.0f}억",'등락률':f"{x.change_pct:+.1f}%"} for x in flow]),hide_index=True,width="stretch")
    with r: st.dataframe(pd.DataFrame([{'종목':x.name,'테마':x.theme,'52주 고점 거리':f"{x.high_52w_distance:+.1f}%",'거래대금':f"{x.trading_value/1e12:.2f}조",'등락률':f"{x.change_pct:+.1f}%"} for x in high]),hide_index=True,width="stretch")

elif page=="후보 발굴":
    header("후보 발굴","하나의 화려한 점수보다 전략 중복, 추세, 거래량, 가격 위치를 분리해 검토합니다.")
    a,b,c=st.columns([1,1,2]); min_score=a.slider("최소 Alpha",0,100,65,5); strategy=b.selectbox("전략",["전체","신고가","돌파","정배열","거래량","눌림목"]); c.caption("실데이터 연결 시: 종목 유니버스, 유동성, 거래대금, 투자자별 수급, 공시·뉴스 필터를 이 단계에 추가합니다.")
    records=[]
    for s in snapshots:
        r=scores[s.code]
        if r.total>=min_score and (strategy=="전체" or strategy in s.strategies): records.append({"종목":s.name,"코드":s.code,"Alpha":r.total,"전략 중복":len(s.strategies),"전략":", ".join(s.strategies),"거래량":f"{s.volume_ratio:.1f}x","고점 거리":f"{s.high_52w_distance:.1f}%","근거":" · ".join(r.reasons)})
    if records: st.dataframe(pd.DataFrame(records).sort_values("Alpha",ascending=False),hide_index=True,width="stretch")
    else: st.info("현재 필터에 해당하는 후보가 없습니다. 억지로 후보를 만들지 않는 것도 중요한 결과입니다.")
    st.divider(); header("반대 신호","후보를 제외하거나 보류해야 하는 사유를 함께 기록합니다."); st.write("• 과도한 이격 · • 거래량 없는 상승 · • 손절 폭 과대 · • 장중 변동성 과대 · • 공시/실적 이벤트 임박")

elif page=="전략 룰":
    header("5대 정밀 진입 전략","모든 조건은 장중 추정값과 종가 확정값을 구분해 기록합니다. 아래 기준은 자동 주문이 아닌 후보 선별·복기 규칙입니다.")
    st.info("공통 필터: 시가총액 1,000억 원 이상 · 거래대금 300억 원 이상. 서비스 운영 시 거래대금 상단/유동성 조건은 전략별로 설정 가능하게 관리합니다.")
    rules=pd.DataFrame([
        ['A','메이저 수급 주도주','거래량 1.5배 이상 + 당일 +14.5% 이상 양봉 장대 돌파'],
        ['B','10일선 급등 눌림목','120일 정배열 + 윗꼬리 ≤ 4.5% + 10일선 터치 후 -1.5~+1.0% 지지 반등'],
        ['C','20일선 정석 눌림목','120일 정배열 + 윗꼬리 ≤ 4.5% + 20일선 터치 후 -2.0~+1.5% 지지 반등'],
        ['D','52주·역사적 신고가 돌파','최근 240거래일 최고 종가 돌파 + 당일 +1.5% 이상 양봉'],
        ['E','바닥 턴어라운드','장기 하락권에서 거래량 동반 + 20일선 첫 상향 돌파 +2.5% 이상 반등'],
    ],columns=['전략','이름','명시적 통과 조건'])
    st.dataframe(rules,hide_index=True,width='stretch')
    st.markdown("#### 주도 섹터 정량 검증")
    st.write("각 섹터에서 **시총 1,000억 이상 + 5>10>20>60>120일 정배열** 종목 비중을 계산하고, 거래대금·가중 수익률·외국인/기관/프로그램 순매수를 함께 점수화합니다. 테마 라벨은 키워드 하나만으로 확정하지 않고 종목별 매핑표와 검토 이력을 유지합니다.")
    st.caption('핵심 15개 자동 라벨: ' + ' · '.join(CORE_SECTOR_KEYWORDS.keys()))
    ep=exit_plan(100_000)
    st.markdown("#### 기본 청산 플레이북")
    st.dataframe(pd.DataFrame([['손절 / 1R',f'{ep.stop:,.0f}원','매수가 대비 -6.0% 도달 시 전량 손절'],['3R 1차 익절',f'{ep.take_profit_3r:,.0f}원','+18.0%에서 50% 분할 익절, 즉시 손절가를 매수가로 상향'],['잔여 추세 추종','최고가 대비 -5.0%','트레일링 스탑 청산'],['타임스탑','40거래일','목표가 미도달 횡보 시 종가 청산'],['선택 보조','SR_RETEST / 이평선','20일 고점 50% 익절, 20일선 이탈 시 청산']],columns=['규칙','예시 매수가 100,000원','행동']),hide_index=True,width='stretch')

elif page=="매매 계획":
    header("한 종목, 한 계획","진입 전에는 ‘왜 살까’보다 ‘언제 틀렸다고 인정할까’를 먼저 기록합니다.")
    s=st.selectbox("종목",snapshots,format_func=lambda x:f"{x.name} ({x.code})"); r,plan=scores[s.code],build_trade_plan(s)
    for col,label,value in zip(st.columns(5),["진입 참고","무효화/손절","1R","2R","3R"],[plan.entry,plan.stop,plan.r1,plan.r2,plan.r3]): col.metric(label,won(value))
    left,right=st.columns(2)
    with left:
        st.markdown("#### 진입 조건"); [st.write("☐ "+x) for x in plan.entry_conditions]; st.markdown("#### 검토 근거"); [st.write("• "+x) for x in r.reasons]
    with right:
        st.markdown("#### 무효화 조건"); [st.write("• "+x) for x in plan.invalidations]; st.markdown("#### 포지션 리스크")
        account=st.number_input("계좌 규모(원)",min_value=0,value=10_000_000,step=1_000_000); budget=st.slider("이 계획의 계좌 리스크",.1,2.0,.5,.1); loss=account*budget/100; shares=int(loss/(plan.entry-plan.stop)) if plan.entry>plan.stop else 0
        st.info(f"계획상 최대 손실: {won(loss)} · 단순 계산 최대 수량: {shares:,}주\n\n수수료·세금·슬리피지·호가 공백은 별도로 고려하세요.")
    thesis=st.text_area("투자 논리/확인할 이벤트",placeholder="예: 다음 실적 발표 전 거래량과 수주 공시를 확인한다.")
    if st.button("관심종목 및 계획 저장",type="primary"): repo.add_watch(s.code,s.name,plan.entry,plan.stop,plan.r3,thesis); st.success("계획을 저장했습니다. 알림은 별도 스케줄러가 실행될 때만 발송됩니다.")

elif page=="내 포트폴리오":
    header("내 포트폴리오","수익 자랑이 아니라, 위험 집중과 계획 이탈을 빨리 찾는 화면입니다."); watched=repo.watchlist(); prices={s.code:s.price for s in snapshots}
    if not watched: st.info("저장된 종목이 없습니다. ‘매매 계획’에서 조건과 손절 기준을 저장하세요.")
    else:
        rows=[]
        for code,name,entry,stop,target3,thesis,created in watched:
            cur=prices.get(code,entry); rr=(cur-entry)/(entry-stop) if entry and entry>stop else 0; rows.append({"종목":name,"매수가":won(entry),"현재가":won(cur),"손절":won(stop),"현재 R":f"{rr:+.2f}R","3R":won(target3),"계획":thesis or "미입력"})
        st.dataframe(pd.DataFrame(rows),hide_index=True,width="stretch"); st.caption("실운영에서는 증권사 보유내역을 읽기 전용으로 동기화하고, 종목·섹터·테마·손실 상관관계·현금 비중을 합산 표시하세요.")

elif page=="검증·일지":
    header("전략 검증과 거래 복기","과거 성과는 미래 수익을 보장하지 않습니다. 표본 외 검증과 비용 반영 없이는 전략을 배포하지 마세요."); m=performance_metrics([.03,-.02,.06,-.01,.04,-.03,.02])
    for col,(label,value) in zip(st.columns(6),[("거래 수",m['trades']),("승률",f"{m['win_rate']}%"),("PF",m['profit_factor']),("MDD",f"{m['mdd']}%"),("기대값",f"{m['expectancy']}%"),("최대 연속 손실",m['max_consecutive_losses'])]): col.metric(label,value)
    st.warning("표시값은 데모입니다. 실제 백테스트에는 수수료·세금·슬리피지·상장폐지·당시 이용 가능 데이터·체결 가능성을 포함해야 합니다."); st.markdown("#### 거래 일지에 반드시 남길 것\n\n진입 당시 근거 · 사전 손절 · 실제 청산 이유 · 계획 준수 여부 · 감정 상태 · 개선할 규칙")
    st.divider(); header("CSV 기반 규칙 검증","Open, High, Low, Close, Signal 컬럼을 가진 일봉 파일을 올리면 신호 다음 날 시가 진입·-6%·3R·트레일링·40일 타임스탑 기준으로 계산합니다.")
    file=st.file_uploader("일봉 CSV 업로드",type='csv')
    if file:
        from alpha_investor.backtest_engine import run_daily_backtest
        try:
            result=run_daily_backtest(pd.read_csv(file)); metric=result['metrics']; st.json(metric); st.caption(result['assumptions'])
            if not result['trades'].empty: st.dataframe(result['trades'],hide_index=True,width='stretch')
        except (ValueError,KeyError) as exc: st.error(str(exc))

elif page=="아침 브리핑":
    from alpha_investor.briefing import load_brief, render_brief
    header("장전 Telegram 브리핑","전날 미국시장·국채·유가·국내 야간선물과 검증된 핵심 뉴스를 한 번에 전달합니다.")
    brief=load_brief()
    if brief:
        st.code(render_brief(brief),language=None)
        st.caption("이 화면은 마지막으로 수집·검증된 스냅샷입니다. Telegram 발송은 스케줄러에서 실행합니다.")
    else:
        st.warning("아직 장전 브리핑 스냅샷이 없습니다.")
        st.code("Copy-Item data/overnight_briefing.example.json data/overnight_briefing.json\npython -m alpha_investor.scheduler --morning-brief",language="powershell")
        st.caption("예시 파일의 ‘데이터 공급자 연결 필요’ 값은 반드시 공식/라이선스 데이터 수집 작업으로 대체하세요.")

else:
    header("연동·운영 체크리스트","알림부터 시작하지 말고 데이터 품질, 책임 경계, 장애 대응을 먼저 고정하세요.")
    st.markdown("**1. 공식 데이터 어댑터** — 시세/체결, 공시, 실적, 투자자별 수급을 출처와 시점까지 저장  \n**2. 이벤트 엔진** — 장전·장중·장후 작업을 분리하고 같은 이벤트의 중복 전송을 차단  \n**3. 알림 채널** — Telegram Bot API 우선. KakaoTalk은 공식 비즈니스/채널 API 또는 조직 소유 공식 게이트웨이만 사용  \n**4. 보안·감사** — 토큰은 환경변수/비밀저장소, 알림·데이터 오류는 로그와 상태 화면으로 추적  \n**5. 서비스 신뢰** — 데이터 갱신 시각, 데이터 공백, 백테스트 가정, 투자 유의문을 항상 표기")
    st.code("streamlit run app.py\npython -m alpha_investor.scheduler\npython -m alpha_investor.scheduler --morning-brief\npython -m alpha_investor.scheduler --collect-eod",language="powershell")
    st.divider(); header("데이터 품질·테마 검토","수집 성공 여부와 라벨의 사람 검토 이력을 보여줍니다.")
    health=repo.recent_health()
    if health: st.dataframe(pd.DataFrame(health,columns=['출처','데이터셋','기준시각','행수','상태','상세','기록시각']),hide_index=True,width='stretch')
    else: st.info('아직 수집 실행 이력이 없습니다. `--collect-eod` 실행 후 상태가 기록됩니다.')
    st.markdown('#### 종목 테마 검토')
    code=st.text_input('종목 코드',placeholder='예: 005930'); primary=st.selectbox('대표 테마',['미분류',*CORE_SECTOR_KEYWORDS.keys()]); secondary=st.text_input('보조 테마'); rationale=st.text_input('검토 근거')
    if st.button('테마 매핑 저장') and code: repo.save_theme_mapping(code,primary,secondary,rationale); st.success('테마 검토 이력을 저장했습니다.')
    mappings=repo.theme_mappings()
    if mappings: st.dataframe(pd.DataFrame(mappings,columns=['종목코드','대표 테마','보조 테마','검토 근거','검토시각']),hide_index=True,width='stretch')
