# Content Engine

웹서비스 운영자가 제품 URL과 브랜드 정보를 등록하면 AI가 소재를 찾고, 검증된 **Content Master**(단일 원본)를 만든 뒤
Threads · Instagram 카드뉴스 · 블로그 · YouTube Shorts로 변환·렌더링·승인·게시·측정까지 지원하는 SaaS입니다.
첫 번째 적용 대상은 배당주 투자자를 위한 웹서비스이며, 종목 추천이나 수익 보장 콘텐츠는 만들지 않습니다.

문서: [구현 계획](../docs/IMPLEMENTATION_PLAN.md) · [아키텍처](../docs/ARCHITECTURE.md) · [운영 배포](../docs/DEPLOYMENT.md)

## 운영 루프

```
제품 분석 → 소재 발견 → Content Master(검증) → 채널 변환 → 이미지/영상 렌더
    ↑                                                        ↓
성과 반영 ← 유입/전환 측정 ← 게시/내보내기 ← 사용자 검토·승인 ←┘
```

## 로컬 실행

```bash
cd content-engine
cp .env.example .env            # AUTH_SECRET, ENCRYPTION_KEY 값을 채우세요 (openssl rand -base64 32)
docker compose up -d            # PostgreSQL 16
npm install
npm run db:migrate              # 마이그레이션 적용 + Prisma Client 생성
npm run db:seed                 # (선택) demo@example.com / demo1234! → /w/demo
npm run fonts:download          # (선택) 카드뉴스/영상용 한글 폰트. 생략하면 첫 렌더 때 자동 다운로드
npm run dev                     # http://localhost:3000
```

외부 API 키가 없어도 전체 흐름이 동작합니다. 기본값은 모두 Mock Provider입니다
(`AI_PROVIDER=mock`, `TTS_PROVIDER=mock`, 채널은 "Mock 계정 연결", `PRODUCT_ANALYZER=auto`는 실패 시 예시 데이터).

Job 처리: 개발 기본값 `JOB_RUNNER=inline`은 요청 안에서 즉시 처리합니다. 운영에서는 `JOB_RUNNER=worker` + `npm run worker`.

## 사용 흐름 (데모)

1. 회원가입 → 워크스페이스 만들기
2. **제품** 등록 → 페이지 분석(또는 직접 입력) → **브랜드 프로필**(말투·금지 표현·CTA·색상)
3. **채널 연결**에서 Mock 계정 연결
4. **콘텐츠 소재**에서 "계산" 탭: 월 목표 배당금 500,000원, 배당수익률 3, 4, 5 → 소재 추가 → 선택 → **Content Master 생성**
5. Master 화면에서 검증 결과 확인 → **선택한 채널 생성** (Threads 3종, 카드뉴스, 블로그, Shorts)
6. 각 채널 화면에서 수정·재생성, 카드뉴스 **PNG 렌더링**(ZIP), 블로그 **Markdown/HTML**, Shorts **MP4 렌더링**
7. **승인함**에서 승인 → 게시(Mock) 또는 예약. 게시 시 CTA 링크가 추적 링크로 바뀝니다
8. **분석**의 SDK 설치 코드를 내 서비스에 붙이면 방문·가입·핵심 기능 사용이 콘텐츠별로 귀속됩니다
9. **분석**/대시보드에서 "성과 분석으로 추천 생성" → 이유와 지표를 보고 승인·반영

## 검증 명령

```bash
npm run lint
npm run typecheck
npm run test          # Vitest 단위·통합 테스트 (DB가 있으면 통합 테스트도 실행)
npm run build
npm run test:e2e      # Playwright (DB 필요, 포트 3100에 dev 서버 자동 실행)
npm run verify        # lint + typecheck + test + build
```

Playwright 브라우저가 별도 경로에 있으면 `CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.
빌드 결과로 E2E를 돌리려면 `E2E_USE_BUILD=1`.

## 구조 요약

- `src/app` App Router. `/w/[slug]/...`가 워크스페이스 영역(레이아웃에서 멤버십 검증)
- `src/server/providers` 교체 가능한 Provider: `ai`(Mock/Anthropic/OpenAI), `storage`(Local/S3), `queue`(PostgreSQL), `tts`(Mock/OpenAI), `publish`(Mock/Threads/WordPress/인터페이스), `analyzer`, `topics`, `analytics`(GA4)
- `src/server/content` 소재·Master·채널 생성, 검증기(consistency, finance-safety), 프롬프트 버전
- `src/server/render` Playwright 이미지 렌더, 카드뉴스 템플릿, FFmpeg Shorts 파이프라인
- `src/server/publish` 상태 머신, 승인, PublishJob
- `src/server/analytics` 추적 링크, 이벤트 수집, 성과 집계, 점수, 추천
- `prisma` 스키마·마이그레이션, `tests/unit`, `tests/e2e`, `public/ce-sdk.js`

## 안전 원칙

- 사용자 승인(APPROVED) 없이는 어떤 채널에도 게시하지 않으며, 게시 핸들러가 승인 상태·승인 버전·검증 결과를 서버에서 다시 확인합니다.
- 채널 콘텐츠의 숫자는 Content Master의 검증된 수치만 사용합니다. 새 숫자는 `NEEDS_SOURCE`로 차단됩니다.
- 금융 안전 검사(수익 보장, 매매 지시, 불안 조성, 오해 비교, 금지 표현, 기준일·세금·환율 누락)에 걸린 콘텐츠는 승인·게시가 막힙니다.
- 비밀정보는 환경변수로만 관리하고 OAuth 토큰은 AES-256-GCM으로 암호화합니다.
- 추적 SDK는 개인정보를 수집하지 않습니다(무작위 익명 ID, 세션, UTM).
