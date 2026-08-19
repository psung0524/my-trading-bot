from __future__ import annotations
import logging
import pandas as pd
import streamlit as st
from alpha_investor.backtest import performance_metrics
from alpha_investor.data_provider import SampleProvider
from alpha_investor.market import classify_market
from alpha_investor.repository import Repository
from alpha_investor.scoring import alpha_score, build_trade_plan

logging.basicConfig(level=logging.INFO)
st.set_page_config(page_title='Alpha Investor', page_icon='📊', layout='wide')
st.title('📊 Alpha Investor — 투자 의사결정·리스크 관리 센터')
st.warning('본 서비스는 투자 조언·매매 추천이 아닌 정보 제공 및 리스크 관리 보조 도구입니다. 투자 판단과 손익의 책임은 사용자에게 있습니다.')

provider, repo = SampleProvider(), Repository()
snapshots = provider.snapshots(); regime = classify_market(provider.index_history())
page = st.sidebar.radio('메뉴', ['오늘의 대시보드','Alpha 스크리너','종목 상세·매매 계획','관심·보유 종목','전략 성과','설정·연동 안내'])

if page == '오늘의 대시보드':
    st.subheader('오늘의 시장 판단')
    a,b,c=st.columns(3); a.metric('시장 국면',regime.label, f'{regime.score}/100'); b.metric('권장 접근',regime.action); c.metric('데이터 상태','샘플 데이터')
    st.caption(' · '.join(regime.reasons))
    ranked=sorted([(s,alpha_score(s,1)) for s in snapshots],key=lambda x:x[1].total,reverse=True)
    st.subheader("🔥 TODAY'S ALPHA")
    st.dataframe(pd.DataFrame([{'종목':s.name,'코드':s.code,'점수':r.total,'상태':r.grade,'변동률':f'{s.change_pct:+.1f}%','근거':' · '.join(r.reasons)} for s,r in ranked]),use_container_width=True,hide_index=True)
    st.info('행동 원칙: 시장 국면과 개별 종목의 무효화 조건을 함께 확인하고, 단일 종목에 과도하게 집중하지 마세요.')

elif page == 'Alpha 스크리너':
    st.subheader('전략별 신호 및 중복 집계')
    strategy=st.multiselect('전략 필터',['신고가','돌파','정배열','거래량','눌림목'])
    rows=[]
    for s in snapshots:
        if strategy and not set(strategy).intersection(s.strategies): continue
        r=alpha_score(s,1); rows.append({'종목':s.name,'점수':r.total,'등급':r.grade,'중복 신호':len(s.strategies),'전략':', '.join(s.strategies),'거래량 배수':s.volume_ratio,'52주 고점 거리':f'{s.high_52w_distance:.1f}%'})
    st.dataframe(pd.DataFrame(rows).sort_values('점수',ascending=False),use_container_width=True,hide_index=True)
    st.caption('신호는 과거 또는 현재 데이터의 조건 충족 표시일 뿐 수익을 보장하지 않습니다.')

elif page == '종목 상세·매매 계획':
    selected=st.selectbox('종목 선택',snapshots,format_func=lambda s:f'{s.name} ({s.code})')
    score=alpha_score(selected,1); plan=build_trade_plan(selected)
    st.subheader(f'{selected.name} · Alpha {score.total}/100 ({score.grade})')
    st.write('점수 근거: '+ ' · '.join(score.reasons))
    cols=st.columns(5)
    for col,label,value in zip(cols,['진입 참고','손절','1R','2R','3R'],[plan.entry,plan.stop,plan.r1,plan.r2,plan.r3]): col.metric(label,f'{value:,.0f}원')
    left,right=st.columns(2)
    with left: st.markdown('#### 진입 전 확인'); [st.write('• '+x) for x in plan.entry_conditions]
    with right: st.markdown('#### 무효화 조건'); [st.write('• '+x) for x in plan.invalidations]
    st.error(f'계획상 최대 가격 리스크: {plan.risk_pct:.2f}%. 실제 주문 전 유동성·호가·시장 상황을 다시 확인하세요.')
    if st.button('관심종목에 계획 저장'):
        repo.add_watch(selected.code,selected.name,plan.entry,plan.stop,plan.r3,'Alpha 스크리너에서 저장'); st.success('저장했습니다.')

elif page == '관심·보유 종목':
    st.subheader('관심·보유 종목 Guardian')
    rows=repo.watchlist()
    if not rows: st.info('종목 상세 화면에서 관심종목을 저장하세요.')
    else:
        price_map={s.code:s.price for s in snapshots}; table=[]
        for code,name,entry,stop,target3,thesis,created in rows:
            now=price_map.get(code,entry); pnl=(now/entry-1)*100 if entry else 0
            table.append({'종목':name,'현재가':f'{now:,.0f}','수익률':f'{pnl:+.2f}%','손절':f'{stop:,.0f}','3R':f'{target3:,.0f}','메모':thesis})
        st.dataframe(pd.DataFrame(table),use_container_width=True,hide_index=True)
        st.caption('백그라운드 감시는 `python -m alpha_investor.scheduler`를 운영체제 스케줄러/컨테이너 스케줄러로 실행하세요.')

elif page == '전략 성과':
    st.subheader('백테스트·전략 성과')
    st.caption('실제 과거 체결·가격 데이터가 연결되기 전에는 아래 예시 수치를 의사결정에 사용하지 마세요.')
    example=[.03,-.02,.06,-.01,.04,-.03,.02]; m=performance_metrics(example)
    cols=st.columns(6)
    for col,(k,v) in zip(cols,[('거래',m['trades']),('승률',str(m['win_rate'])+'%'),('PF',m['profit_factor']),('MDD',str(m['mdd'])+'%'),('기대값',str(m['expectancy'])+'%'),('연속 손실',m['max_consecutive_losses'])]): col.metric(k,v)
    st.write('검증 기준: 수수료·세금·슬리피지, 상장폐지 종목, 체결 가능성, 표본 외 기간을 반드시 반영해야 합니다.')

else:
    st.subheader('설정·합법적 알림 연동')
    st.markdown('''
`.env`에 Telegram Bot Token과 Chat ID를 설정하면 알림 모듈이 Telegram Bot API로 발송합니다.

KakaoTalk은 개인 채팅 매크로·비공식 자동화를 사용하지 않습니다. 조직이 보유한 공식 카카오 비즈니스/채널 API 또는 검증된 공식 게이트웨이의 웹훅만 `KAKAO_OFFICIAL_WEBHOOK_URL`로 연결하도록 설계했습니다.

증권사 API, 실시간 수급, DART 공시, 뉴스, 투자일지는 `alpha_investor/data_provider.py`의 공급자 어댑터를 확장해 연결하세요. 토큰은 소스 코드가 아니라 비밀 관리 도구나 환경 변수에 보관하세요.
''')
