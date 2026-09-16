# 아키텍처 (ARCHITECTURE)

기준일: 2026-09-16

## 1. 개요

Content Engine은 웹서비스 운영자가 제품 URL과 브랜드 정보를 등록하면 AI가 소재를 찾고,
검증된 **Content Master**(단일 원본)를 만든 뒤 Threads / Instagram 카드뉴스 / 블로그 / YouTube Shorts로
변환·렌더링·승인·게시·측정까지 이어지는 운영 루프를 제공하는 멀티테넌트 SaaS다.

```
제품 분석 → 소재 발견 → Content Master(검증) → 채널 변환 → 이미지/영상 렌더
    ↑                                                        ↓
성과 반영 ← 유입/전환 측정 ← 게시/내보내기 ← 사용자 검토·승인 ←┘
```

## 2. 스택과 선택 이유

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js 16.3 (App Router, Turbopack), React 19, TypeScript strict | 요구사항. Next 16에서는 `middleware.ts` 대신 `proxy.ts`, `params`/`cookies()`는 async |
| UI | Tailwind CSS v4, shadcn/ui(new-york-v4) 소스 복사, lucide-react, sonner | 레지스트리 접근이 막힌 환경 대응으로 CLI 대신 소스 복사 |
| 폼/검증 | React Hook Form + Zod v4 | 서버 액션에서도 동일 Zod 스키마 재사용 |
| 데이터 | PostgreSQL 16, Prisma 6 | Prisma 8은 RC라 6.x 안정 버전 사용 |
| 인증 | Auth.js v5 (`next-auth@beta`), Credentials(bcrypt) + JWT 세션, Prisma Adapter | OAuth는 env가 있을 때만 활성화 |
| Queue | `Job` 테이블 기반 DbJobQueue (`FOR UPDATE SKIP LOCKED`) | `JobQueueProvider` 인터페이스로 BullMQ 교체 가능 |
| 파일 | `StorageProvider`: Local(개발) / S3 호환(운영) | 파일은 `/api/files/[...key]`로 서빙(권한 확인) |
| AI | `AIProvider`: Mock / Anthropic / OpenAI, Zod→JSON Schema structured output, PromptTemplate/PromptVersion DB 관리 | 기본값 Mock |
| 이미지 | HTML/CSS 템플릿 → Playwright Chromium 스크린샷(PNG) | 자유형 AI 이미지 생성은 사용하지 않음 |
| 영상 | FFmpeg(`ffmpeg-static`), 1080x1920 30fps H.264/AAC | `TTSProvider`(Mock/OpenAI) + 자막(drawtext/ASS) |
| 분석 | 자체 TrackingLink + `/api/collect` + `public/ce-sdk.js` | `AnalyticsProvider`로 GA4 확장 |
| 테스트 | Vitest(+RTL), Playwright E2E | |

## 3. 디렉터리 구조 (`content-engine/`)

```
prisma/                 schema.prisma, migrations/, seed.ts
public/ce-sdk.js        추적 SDK
src/app/
  (marketing)/          랜딩
  (auth)/login, signup
  onboarding/           워크스페이스 생성
  w/[slug]/             워크스페이스 영역 (레이아웃에서 멤버십 검증)
    page.tsx            AI 직원형 대시보드
    products/ brand/ topics/ calendar/ content/ renders/ inbox/ schedule/
    channels/ analytics/ learning/ settings/ audit/
  api/
    auth/[...nextauth]  Auth.js
    collect/            이벤트 수집 (공개, rate limit)
    t/[code]/           추적 링크 리다이렉트
    files/[...key]/     스토리지 서빙
    jobs/               워커 헬스/수동 tick(관리자)
    webhooks/           서명 검증
src/components/ui       shadcn 컴포넌트
src/components/         앱 컴포넌트
src/lib/                브라우저/서버 공용 유틸 (zod 스키마, 상수, cn)
src/server/
  auth/                 auth.ts, password.ts, session helpers
  db/                   prisma client
  tenancy/              requireWorkspaceMember, 권한 매트릭스
  providers/            ai/ storage/ queue/ image/ video/ tts/ publish/ analyzer/ topics/ analytics/ ratelimit/
  content/              content master 생성, validators (consistency, finance-safety), channel transformers
  render/               cardnews templates, storyboard, ffmpeg pipeline
  publish/              approval state machine, publish jobs
  analytics/            event ingest, performance score, recommendations
  jobs/                 job handlers registry, worker loop
  security/             crypto(AES-GCM), audit log, idempotency
src/proxy.ts            인증 리다이렉트(낙관적 검사)
tests/unit              Vitest
tests/e2e               Playwright
scripts/worker.ts       Job 워커
docker-compose.yml      PostgreSQL
```

## 4. 멀티테넌시와 권한

- 모든 도메인 데이터는 `workspaceId`를 가진다.
- 서버 액션과 라우트 핸들러는 반드시 `requireWorkspaceMember(slugOrId, minRole)`을 호출해 `{ user, workspace, member }`를 받은 뒤, 그 `workspace.id`로만 조회/수정한다.
- 역할: `OWNER > ADMIN > EDITOR > VIEWER`. 승인/게시는 ADMIN 이상, 콘텐츠 편집은 EDITOR 이상, 설정/멤버/삭제는 OWNER.
- 리소스 단건 조회는 `findFirst({ where: { id, workspaceId } })` 형태를 강제한다(`findUnique({ id })` 금지).
- `proxy.ts`는 로그인 여부만 낙관적으로 확인하고, 실제 권한은 서버 컴포넌트/액션에서 검증한다.

## 5. Content Master와 검증

- `ContentMaster.facts[]`: `{ key, label, value, unit, formula?, assumptions?, sourceRef? }`
- `ContentMaster.asOfDate`, `sources[]`, `cautions[]`, `cta` 필수.
- 채널 콘텐츠의 숫자는 `facts.key` 참조로만 허용. 새 숫자가 나오면 Consistency Validator가 `NEEDS_SOURCE`로 표시.
- Finance Safety 모듈(`src/server/content/finance-safety.ts`) 검사 항목: 수익 보장 표현, 매수/매도 지시, 기준일 누락, 출처 없는 숫자, 세금/환율 조건 누락, 숫자 불일치, 불안 조성, 오해 비교. `BLOCK` 결과가 있으면 승인/게시 불가.
- 계산 소재(CALCULATION)는 서버의 결정론적 계산기(`dividend-calculator.ts`)가 숫자를 만들고, AI는 문장만 만든다.

## 6. 콘텐츠 상태 머신

```
IDEA → GENERATING → DRAFT → NEEDS_REVIEW → APPROVED → SCHEDULED → PUBLISHING → PUBLISHED
                       │          │            │                        └→ FAILED (재시도 가능)
                       │          └→ REJECTED   └→ (승인 취소) NEEDS_REVIEW
                       └→ NEEDS_SOURCE (출처 보강 후 DRAFT)
어느 상태에서나 → ARCHIVED
```

전이는 `src/server/publish/state-machine.ts`의 허용 표로만 수행하고, 게시 핸들러는 DB에서 `APPROVED`/`SCHEDULED`를 다시 확인한다.

## 7. 비동기 Job

- `Job(type, payload, status, attempts, maxAttempts, idempotencyKey unique, lockedAt, lockedBy, lastError, logs)`
- 워커: `scripts/worker.ts` 폴링(기본 2초). `JOB_RUNNER=inline`이면 enqueue 직후 같은 프로세스에서 처리(개발/E2E).
- 핸들러 종류: `content.generate`, `render.cardnews`, `render.shorts`, `publish.channel`, `analytics.rollup`.
- 실패 시 `attempts < maxAttempts`면 지수 backoff로 재큐잉, 초과 시 FAILED + 사용자에게 원인 표시 + 재시도 버튼.

## 8. 분석

- TrackingLink: `/api/t/{code}` → 302 → 목적지 URL + UTM(`utm_source=channel`, `utm_medium=social|blog|video`, `utm_campaign=campaign slug`, `utm_content=channelContentId`). 클릭 이벤트 저장.
- SDK: `public/ce-sdk.js`가 `anonymousId`(localStorage), `sessionId`, UTM(첫 방문 sessionStorage)을 붙여 `/api/collect`로 전송. 개인정보(이메일 등)는 받지 않으며 `properties` 크기 제한.
- 이벤트 → `AnalyticsEvent`. 일일 롤업 `ContentPerformance`. 점수:
  `score = clickRate*0.20 + signupRate*0.35 + activationRate*0.30 + returnRate*0.15` (워크스페이스별 가중치 조정 가능)

## 9. 보안

- 비밀정보는 env만 사용(`.env.example` 제공). OAuth 토큰은 AES-256-GCM(`ENCRYPTION_KEY`)으로 암호화 저장.
- Zod로 모든 입력 검증, Prisma 파라미터 쿼리(SQL Injection 방지), React 기본 이스케이프 + 블로그 HTML은 sanitize 후 출력(XSS).
- 서버 액션은 Next.js가 Origin 검사로 CSRF 대응. 공개 API(`/api/collect`)는 CORS 허용 + rate limit.
- Rate limit: 메모리 토큰 버킷(`RateLimiter` 인터페이스). 업로드는 타입/크기 제한.
- 감사 로그(`AuditLog`)에 주요 변경/승인/게시/삭제 기록.
- Webhook은 HMAC 서명 검증. PublishJob은 `idempotencyKey` unique로 중복 게시 방지.

## 10. 스택 변경 기록

| 날짜 | 변경 | 이유 |
| --- | --- | --- |
| 2026-09-16 | shadcn CLI 대신 소스 복사 | `ui.shadcn.com` 네트워크 차단 |
| 2026-09-16 | Prisma 6.x 채택 | 최신 태그가 8.0 RC라 안정판 사용 |
| 2026-09-16 | 세션 검증용 PostgreSQL을 로컬 바이너리로 실행 | Docker 데몬 없음. 사용자 환경은 docker-compose 사용 |
