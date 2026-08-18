import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Any
import json
import os
from openai import OpenAI

# ==========================================
# 1. 삼성증권 엑셀 파서 (실제 양식 반영)
# ==========================================
class SamsungSecuritiesParser:
    @staticmethod
    def load_and_normalize(file_path: str) -> pd.DataFrame:
        # 엑셀 읽기 (모든 컬럼명을 공백 제거하여 표준화)
        raw_df = pd.read_excel(file_path, header=None)
        
        header_row_idx = None
        for idx, row in raw_df.iterrows():
            row_str = "".join(row.dropna().astype(str).tolist()).replace(" ", "")
            # 실제 엑셀의 핵심 키워드 검색
            if '매매일' in row_str and ('체결수량' in row_str or '체결평균가' in row_str):
                header_row_idx = idx
                break
                
        if header_row_idx is None:
            # 1행이 바로 헤더인 경우 기본 0번 인덱스 사용
            header_row_idx = 0

        df = pd.read_excel(file_path, skiprows=header_row_idx)
        # 컬럼명의 모든 공백 제거 (예: '매 매 일' -> '매매일', '종 목 명' -> '종목명')
        df.columns = [str(c).strip().replace(" ", "") for c in df.columns]

        # 실제 엑셀 컬럼명 -> 표준 필드명 매핑
        col_map = {
            '매매일': 'trade_date',
            '체결일자': 'trade_date',
            '거래일자': 'trade_date',
            '종목명': 'ticker',
            '종목': 'ticker',
            '주문구분': 'side',
            '구분': 'side',
            '체결수량': 'quantity',
            '체결평균가': 'price',
            '체결단가': 'price',
            '체결금액': 'trade_amount',
            '정산금액': 'net_amount'
        }
        
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

        # 필수 컬럼 존재 확인
        required = ['trade_date', 'ticker', 'side', 'quantity', 'price']
        for req in required:
            if req not in df.columns:
                raise ValueError(f"필수 컬럼 누락: {req} (현재 컬럼 목록: {list(df.columns)})")

        # 결측치 제거
        df = df.dropna(subset=['ticker', 'quantity', 'price']).copy()
        
        # 날짜 포맷 변환
        df['trade_datetime'] = pd.to_datetime(df['trade_date'])

        # 매수 / 매도 판별 (유통융자매수, 자기융자매수, 현금매수 등 모두 처리)
        df['side'] = df['side'].astype(str).apply(
            lambda x: 'BUY' if '매수' in x else ('SELL' if '매도' in x else 'OTHER')
        )
        df = df[df['side'].isin(['BUY', 'SELL'])].copy()

        # 수치형 변환
        for col in ['quantity', 'price']:
            df[col] = df[col].astype(str).str.replace(',', '').astype(float)

        # 시간순 정렬 (과거 -> 최신)
        df = df.sort_values(by=['trade_datetime']).reset_index(drop=True)
        return df[['trade_datetime', 'ticker', 'side', 'quantity', 'price']]


# ==========================================
# 2. FIFO 매수-매도 매칭 엔진
# ==========================================
class TradeFIFOEngine:
    @staticmethod
    def process_trades(df: pd.DataFrame) -> List[Dict[str, Any]]:
        closed_trades = []
        buy_queues: Dict[str, List[Dict[str, Any]]] = {}

        for _, row in df.iterrows():
            ticker = row['ticker']
            side = row['side']
            qty = row['quantity']
            price = row['price']
            dt = row['trade_datetime']

            if side == 'BUY':
                if ticker not in buy_queues:
                    buy_queues[ticker] = []
                buy_queues[ticker].append({'dt': dt, 'qty': qty, 'price': price})

            elif side == 'SELL':
                if ticker not in buy_queues or not buy_queues[ticker]:
                    continue

                sell_qty_remaining = qty
                while sell_qty_remaining > 0 and buy_queues[ticker]:
                    oldest_buy = buy_queues[ticker][0]
                    matched_qty = min(sell_qty_remaining, oldest_buy['qty'])

                    buy_price = oldest_buy['price']
                    sell_price = price
                    entry_dt = oldest_buy['dt']
                    exit_dt = dt

                    pnl_amount = (sell_price - buy_price) * matched_qty
                    return_pct = ((sell_price - buy_price) / buy_price) * 100
                    holding_days = (exit_dt - entry_dt).days

                    closed_trades.append({
                        'ticker': ticker,
                        'entry_date': entry_dt.strftime('%Y-%m-%d'),
                        'exit_date': exit_dt.strftime('%Y-%m-%d'),
                        'holding_days': holding_days,
                        'quantity': matched_qty,
                        'buy_price': buy_price,
                        'sell_price': sell_price,
                        'pnl_amount': round(pnl_amount, 0),
                        'return_pct': round(return_pct, 2)
                    })

                    sell_qty_remaining -= matched_qty
                    oldest_buy['qty'] -= matched_qty

                    if oldest_buy['qty'] <= 0:
                        buy_queues[ticker].pop(0)

        return closed_trades


# ==========================================
# 3. 행동 통계 추출기
# ==========================================
class TradingMetricsAnalyzer:
    @staticmethod
    def generate_summary(trades: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not trades:
            return {"error": "매수 후 매도까지 완료된 거래 내역이 없습니다."}

        df = pd.DataFrame(trades)
        wins = df[df['pnl_amount'] > 0]
        losses = df[df['pnl_amount'] < 0]

        total_trades = len(df)
        win_count = len(wins)
        win_rate = (win_count / total_trades) * 100 if total_trades > 0 else 0

        avg_win_pct = wins['return_pct'].mean() if not wins.empty else 0.0
        avg_loss_pct = losses['return_pct'].mean() if not losses.empty else 0.0

        total_profit = wins['pnl_amount'].sum() if not wins.empty else 0.0
        total_loss = abs(losses['pnl_amount'].sum()) if not losses.empty else 0.0
        profit_factor = round(total_profit / total_loss, 2) if total_loss > 0 else 999.0

        summary = {
            "period": f"{df['entry_date'].min()} ~ {df['exit_date'].max()}",
            "overview": {
                "total_matched_trades": total_trades,
                "win_rate": f"{round(win_rate, 1)}%",
                "profit_factor": profit_factor,
                "total_net_pnl": f"{int(df['pnl_amount'].sum()):,}원",
                "avg_win_return": f"+{round(avg_win_pct, 2)}%",
                "avg_loss_return": f"{round(avg_loss_pct, 2)}%",
                "risk_reward_ratio": round(abs(avg_win_pct / avg_loss_pct), 2) if avg_loss_pct != 0 else 0.0
            },
            "holding_period": {
                "avg_win_holding_days": round(wins['holding_days'].mean(), 1) if not wins.empty else 0,
                "avg_loss_holding_days": round(losses['holding_days'].mean(), 1) if not losses.empty else 0
            },
            "top_profit_trades": df.sort_values(by='pnl_amount', ascending=False).head(3).to_dict(orient='records'),
            "top_loss_trades": df.sort_values(by='pnl_amount').head(3).to_dict(orient='records')
        }

        return summary


# ==========================================
# 4. 실행 및 AI 코칭 리포트 생성
# ==========================================
# OpenAI API 키 입력 (또는 시스템 환경변수 사용)
from google import genai
import json

client = genai.Client(api_key="AIzaSyCbzTykCVp71GhEVo4E6GbjayEgqsLR8kc")

def get_best_available_model():
    """현재 API 키로 사용 가능한 최적의 Gemini Flash 모델을 자동 탐색"""
    try:
        models = [m.name for m in client.models.list()]
        # flash 계열 우선 선택 (예: gemini-2.5-flash, gemini-2.5-pro 등)
        for target in ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash']:
            for m in models:
                if target in m:
                    return m.replace("models/", "")
        # 없으면 목록의 첫 번째 생성형 모델 반환
        return models[0].replace("models/", "")
    except Exception:
        return "gemini-2.5-flash"

def run_trading_analysis(file_path: str):
    print("⏳ 1. 삼성증권 엑셀 파싱 및 통계 계산 중...")
    df = SamsungSecuritiesParser.load_and_normalize(file_path)
    trades = TradeFIFOEngine.process_trades(df)
    metrics = TradingMetricsAnalyzer.generate_summary(trades)
    
    metrics_json = json.dumps(metrics, ensure_ascii=False, indent=2)
    print("✅ 데이터 정제 완료!\n")
    print(metrics_json)
    
    print("\n⏳ 2. AI 트레이딩 코칭 리포트 생성 중...")
    selected_model = get_best_available_model()
    print(f"🔹 사용할 모델: {selected_model}")

    prompt = f"""
당신은 냉철한 퀀트 트레이더이자 멘탈 코치입니다.
아래 사용자의 최근 매매 통계 수치(승률, 손익비, 보유일수, 종목별 손익)를 바탕으로 매매 습관과 문제점을 날카롭게 분석하고, 구체적인 행동 개선 규칙 3가지를 제안하세요.

[매매 통계 데이터]
{metrics_json}
"""
    try:
        response = client.models.generate_content(
            model=selected_model,
            contents=prompt,
        )
        print("\n================ [AI 진단 리포트] ================\n")
        print(response.text)
    except Exception as e:
        print(f"\n⚠️ API 호출 실패: {e}")

if __name__ == "__main__":
    run_trading_analysis("전체거래내역.xlsx")