# 구현 계획 (IMPLEMENTATION_PLAN)

기준일: 2026-09-16
대상: 배당주 웹서비스 운영자를 위한 AI 콘텐츠 운영 SaaS ("Content Engine")
코드 위치: `content-engine/` (기존 Python 트레이딩 봇과 분리)

## 0. 현재 저장소 분석

| 항목 | 내용 |
| --- | --- |
| 기존 코드 | `app.py`, `main.py`, `screener.py`, `watcher.py`, `notifier.py` (Python, Streamlit) |
| 성격 | 네이버 금융 스크리너 + 삼성증권 거래내역 분석 + 텔레그램 알림. 개인용 트레이딩 도구 |
| 재사용 가능성 | 없음. 언어(Python)와 목적(주식 매매)이 모두 다름. 요구사항의 스택은 Next.js/TypeScript |
| 결정 | 기존 파일은 손대지 않고 `content-engine/` 하위 디렉터리에 새 앱을 만든다. 문서는 저장소 루트 `docs/`에 둔다 |

환경 확인 결과 (개발 세션 기준):

- Node 22, npm 10, Docker CLI 있음(데몬은 이 세션에서 실행 불가 → 로컬 PostgreSQL 16 바이너리로 검증)
- Playwright Chromium 141 설치됨(`/opt/pw-browsers/chromium`)
- 시스템 ffmpeg 없음. Playwright 번들 ffmpeg는 VP8 전용 → `ffmpeg-static`(libx264/aac 포함) 사용
- `ui.shadcn.com` 접근 차단 → shadcn 컴포넌트 소스를 GitHub raw에서 직접 가져와 `src/components/ui`에 저장

## 1. 요구사항 정리 (기능 단위)

### MVP 필수 (M)

| ID | 기능 | Phase |
| --- | --- | --- |
| M-01 | 이메일+비밀번호 회원가입/로그인, JWT 세션 | 1 |
| M-02 | 워크스페이스 생성, 멤버 역할(OWNER/ADMIN/EDITOR/VIEWER), 모든 조회에 workspaceId 검증 | 1 |
| M-03 | 제품 등록(이름/URL/설명), URL 분석(Mock Analyzer) 또는 수동 입력 | 2 |
| M-04 | 브랜드 프로필(말투, 금지 표현, CTA, 색상, 면책 문구 등) + BrandRule | 2 |
| M-05 | AI 직원형 대시보드(승인 필요/렌더링 중/오늘 게시/7일 성과/추천 행동) | 2, 6, 7 |
| M-06 | 콘텐츠 소재(ContentTopic) 생성: MANUAL_INPUT, USER_QUESTION, CALCULATION, FEATURE_UPDATE | 3 |
| M-07 | 콘텐츠 유형 비율 관리(정보 40/데이터 25/참여 15/브랜딩 10/홍보 10)와 추천 | 3, 7 |
| M-08 | Content Master 생성 + Consistency/Finance Safety Validator | 3 |
| M-09 | Threads 3종(정보형/관찰형/참여형) 생성 및 편집 | 3, 4 |
| M-10 | Instagram 카드뉴스 5~8장 JSON → 1080x1350 PNG, ZIP, 캡션/해시태그/ALT | 3, 4 |
| M-11 | 블로그 글 생성, Markdown/HTML 내보내기, 썸네일 | 3, 4 |
| M-12 | Shorts 대본/Storyboard → Mock TTS → 자막 → FFmpeg 1080x1920 MP4 (RenderJob, 재시도) | 3, 4 |
| M-13 | 승인 워크플로(상태 머신), 서버측 APPROVED 확인, 승인 로그 | 5 |
| M-14 | PublishJob: Mock Publisher, Threads Provider, 예약 게시, 외부 게시물 ID 저장 | 5 |
| M-15 | Tracking Link(UTM), 클릭 리다이렉트, 이벤트 수집 API, JS SDK, 설치 코드 | 6 |
| M-16 | 분석 대시보드(채널/콘텐츠/소재/CTA별), 미제공 지표 N/A | 6 |
| M-17 | 규칙 기반 Performance Score, 다음 소재 추천, 사용자 승인 후 반영 | 7 |
| M-18 | Brand Learning(원본/수정본 저장, diff 분석, 사용자 확인/삭제) | 4, 7 |
| M-19 | 보안: Zod 검증, 권한, rate limit, 감사 로그, 토큰 암호화, idempotency, 중복 게시/렌더 방지 | 1~8 |
| M-20 | 단위 테스트(Vitest), E2E(Playwright) 핵심 시나리오, README, 배포 가이드 | 8 |

### 이후 기능 (L: Later)

| ID | 기능 |
| --- | --- |
| L-01 | 소셜 로그인(Google/GitHub) 실제 연동 — 코드 구조는 준비, env 있을 때만 활성 |
| L-02 | Instagram Graph API 실제 게시, WordPress 실제 게시, YouTube 실제 업로드 (Provider 인터페이스 + Mock만 MVP) |
| L-03 | TREND, FREQUENTLY_VIEWED, PRODUCT_DATA, EDUCATIONAL, COMMUNITY_QUESTION 소재 실제 수집 (MVP는 Mock Data) |
| L-04 | Redis/BullMQ Queue, S3 운영 스토리지 실제 배포 검증 |
| L-05 | GA4 AnalyticsProvider 연동 |
| L-06 | 실제 TTS(OpenAI) 품질 튜닝, 배경음 라이브러리 |
| L-07 | 워크스페이스 멤버 초대 이메일, 결제/구독 |

## 2. 기술적 위험 요소와 대응

| 위험 | 영향 | 대응 |
| --- | --- | --- |
| Next.js 16 API 변화(async params, proxy.ts, Turbopack) | 빌드 실패 | 번들 문서(`node_modules/next/dist/docs`) 기준으로 작성. `middleware` 대신 `proxy.ts` |
| Auth.js v5 beta 안정성 | 인증 장애 | Credentials + JWT 전략(가장 단순한 경로). 문제 시 자체 세션 구현으로 교체 가능하도록 `src/lib/auth` 경계 유지 |
| Playwright 렌더링 메모리/속도 | 카드뉴스/영상 렌더 지연 | 브라우저 인스턴스 재사용, 렌더는 비동기 Job으로 처리, 동시 실행 제한 |
| FFmpeg 바이너리 배포 | 운영 환경에서 영상 실패 | `ffmpeg-static` 기본, `FFMPEG_PATH` 환경변수로 교체 가능 |
| AI 출력 형식 불안정 | 파이프라인 중단 | Zod 스키마로 structured output 검증, 실패 시 1회 재시도 후 NEEDS_REVIEW |
| 금융 콘텐츠 오류(숫자 불일치, 출처 없음) | 신뢰/법적 위험 | Content Master 단일 원본, Consistency Validator + Finance Safety 모듈, NEEDS_SOURCE 상태 |
| 멀티테넌트 데이터 누출 | 보안 사고 | 모든 서버 액션/라우트는 `requireWorkspaceMember()` 경유, Prisma 쿼리에 workspaceId 조건 필수 |
| DB 기반 Queue의 중복 실행 | 영상 이중 렌더/이중 게시 | `SELECT ... FOR UPDATE SKIP LOCKED` 잠금 + idempotency key unique 제약 |
| 외부 API 키 부재 | 데모 불가 | 모든 외부 의존은 Mock Provider 기본값 |

## 3. 데이터 모델 초안

Prisma 스키마(`content-engine/prisma/schema.prisma`)로 구현. 모든 모델에 `createdAt`, `updatedAt`. 사용자 콘텐츠 계열은 `deletedAt` soft delete.

핵심 관계:

```
User ─< WorkspaceMember >─ Workspace ─< Product ─ BrandProfile ─< BrandRule / BrandLearning
                                      │            └< DataSource
                                      ├< ContentTopic ─< ContentSource
                                      │       └< ContentMaster ─< ChannelContent ─< ContentVersion
                                      │                                  ├< CreativeAsset
                                      │                                  ├< Approval
                                      │                                  ├< PublishJob
                                      │                                  ├< RenderJob
                                      │                                  └< TrackingLink ─< AnalyticsEvent
                                      ├< Campaign ─< CampaignItem
                                      ├< ChannelAccount
                                      ├< ContentPerformance
                                      ├< PromptTemplate ─< PromptVersion
                                      ├< Job (큐)
                                      └< AuditLog
```

상태 enum:

- `ContentStatus`: IDEA, GENERATING, DRAFT, NEEDS_REVIEW, NEEDS_SOURCE, APPROVED, SCHEDULED, PUBLISHING, PUBLISHED, FAILED, REJECTED, ARCHIVED
- `JobStatus`: QUEUED, PROCESSING, SUCCEEDED, FAILED, CANCELED
- `ChannelType`: THREADS, INSTAGRAM, BLOG, YOUTUBE_SHORTS
- `SourceType`: PRODUCT_DATA, MANUAL_INPUT, USER_QUESTION, TREND, FREQUENTLY_VIEWED, CALCULATION, FEATURE_UPDATE, EDUCATIONAL, COMMUNITY_QUESTION
- `ContentCategory`: INFORMATIONAL, DATA, ENGAGEMENT, BRANDING, PROMOTION
- `WorkspaceRole`: OWNER, ADMIN, EDITOR, VIEWER

금융 데이터 규칙: `ContentMaster.asOfDate`, `ContentMaster.sources(JSON: name, url, retrievedAt)` 필수 필드. 숫자는 `facts` JSON 배열(`key, label, value, unit, formula?, sourceRef?`)로 저장하고 채널 콘텐츠는 이 key만 참조한다.

## 4. Provider 인터페이스

`content-engine/src/server/providers/*`에 위치. 각 Provider는 `interface + Mock + 실제 구현 + factory(환경변수로 선택)`.

| Provider | 인터페이스 요약 | Mock | 실제 |
| --- | --- | --- | --- |
| AIProvider | `generateStructured<T>({schema, system, prompt, promptKey})` | 결정론적 예시 응답 | Anthropic(tool use), OpenAI(json_schema) |
| StorageProvider | `put/get/delete/getUrl` | — | Local(`./storage`), S3 호환 |
| JobQueueProvider | `enqueue/claim/complete/fail` | — | DbJobQueue(PostgreSQL), 추후 BullMQ |
| ImageRenderer | `renderHtmlToPng(html, size)` | — | Playwright Chromium |
| VideoRenderer | `compose(storyboard, assets) → mp4` | — | FFmpeg |
| TTSProvider | `synthesize(text, voice) → {audio, durationMs}` | 무음+톤 WAV | OpenAI TTS |
| PublisherProvider(채널별) | `publish(content, account) → {externalId, url}` | MockPublisher | ThreadsPublisher, (Instagram/WordPress/YouTube 인터페이스만) |
| ProductAnalyzer | `analyze(url) → {title, description, features, keywords}` | Mock | HTML 메타 파싱 |
| TopicSourceProvider | `discover(product) → TopicCandidate[]` | Mock(TREND 등) | MANUAL/USER_QUESTION/CALCULATION/FEATURE_UPDATE 실제 |
| AnalyticsProvider | `track(event)` / `query(range)` | 자체 DB | GA4(인터페이스만) |
| RateLimiter | `check(key, limit, window)` | 메모리 | Redis(추후) |

## 5. 구현 순서와 진행 상태 (2026-09-16 기준: Phase 0~8 완료)

| Phase | 범위 | 완료 기준 | 상태 |
| --- | --- | --- | --- |
| 0 | 저장소 분석, 문서, 스키마 설계 | 본 문서 + ARCHITECTURE.md | ✅ |
| 1 | Next.js/TS/Tailwind/shadcn, Prisma+PostgreSQL+migration, Docker Compose, Auth.js, Workspace 멀티테넌트, Vitest/Playwright 설정 | 회원가입→로그인→워크스페이스 생성 E2E 통과, lint/typecheck/test/build 통과 | ✅ |
| 2 | Product 등록/분석, BrandProfile, BrandRule, 대시보드 골격 | 온보딩 흐름 E2E | ✅ |
| 3 | ContentTopic, ContentMaster, AIProvider(Mock/Anthropic/OpenAI), Validator, 4개 채널 structured output | "월 50만 원 배당" 소재 → Master → 4채널 초안 생성 | ✅ |
| 4 | Threads/카드뉴스/블로그/Storyboard 편집기, PNG 렌더, Mock TTS, FFmpeg MP4, RenderJob | PNG ZIP, MP4 다운로드 | ✅ |
| 5 | Approval, PublishJob, MockPublisher/Threads Provider, 내보내기, 예약 게시 | 승인 후 게시, 미승인 게시 서버 거부 | ✅ |
| 6 | TrackingLink, 이벤트 SDK, 수집 API, 분석 대시보드, ContentPerformance | 클릭→가입 이벤트가 대시보드에 표시 | ✅ |
| 7 | Performance Score, 추천 생성, 사용자 승인 반영, Brand Learning 관리 | 추천 카드 표시/승인 | ✅ |
| 8 | 테스트 보강, 보안 점검, 접근성, 성능, README, 배포 가이드 | 완료 조건 18단계 E2E 통과 | ✅ |

각 Phase 종료 시 `npm run lint && npm run typecheck && npm run test && npm run build`를 실행하고 결과를 기록한다.

## 6. 기본값으로 결정한 사항 (질문 대신 선택)

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| 앱 위치 | `content-engine/` 하위 디렉터리 | 기존 Python 코드와 분리 |
| 인증 | Auth.js v5(next-auth@beta) + Credentials + JWT | 외부 키 없이 동작, App Router 호환 |
| ORM | Prisma 6.x (안정) | Prisma 8은 RC 단계 |
| UI | Tailwind v4 + shadcn(new-york-v4) 소스 복사 | shadcn 레지스트리 접근 차단 환경에서도 재현 가능 |
| 기본 언어 | UI 한국어 | 첫 고객이 한국 배당주 서비스 |
| 파일 저장 | 로컬 `content-engine/storage/` (gitignore) | 개발 기본값. S3는 env로 전환 |
| Queue | PostgreSQL `Job` 테이블 + `npm run worker` 또는 `JOB_RUNNER=inline` | 외부 인프라 없이 동작 |
| 렌더 브라우저 | `CHROMIUM_PATH` 또는 playwright-core 기본 경로 | 세션 환경 대응 |
| 영상 | ffmpeg-static, 1080x1920, 30fps, H.264/AAC | 요구사항 그대로 |
| 워크스페이스 URL | `/w/[slug]/...` | 멀티테넌트 명시 |
| 소셜 로그인 | env 존재 시에만 Provider 등록 | 키 없이도 빌드 |
| 이메일 발송 | MVP 미구현(가입 즉시 활성) | 외부 SMTP 의존 제거 |

## 7. 완료 조건(§17) 검증 결과

`tests/e2e/mvp-scenario.spec.ts`가 18단계를 한 흐름으로 실행한다. 회원가입 → 워크스페이스 → 제품·브랜드 → 계산 소재 → Content Master(2억/1억 5,000만/1억 2,000만 원 검증) → Threads 3종·카드뉴스·블로그·Shorts 생성 → PNG·Markdown·MP4 다운로드 → 수정·승인 → Mock 게시 → 추적 링크 클릭 → SDK 가입 이벤트 → 분석 대시보드 → 추천 생성.

## 8. 남은 문제와 다음 단계

| 항목 | 상태 | 비고 |
| --- | --- | --- |
| Instagram/YouTube 실제 API 게시 | 인터페이스만 | Provider 구현 후 `getPublisher()`에 연결. 승인·멱등·서버 재검증 로직은 그대로 재사용 |
| TREND 등 소재 소스의 실제 데이터 | Mock | 외부 API 연결 시 `TopicSourceProvider` 구현 |
| 자막 타이밍 | 장면 단위 | 단어 단위 타이밍은 실제 TTS의 timestamp 지원이 필요 |
| Redis 기반 rate limit/queue | 인터페이스만 | 다중 인스턴스 운영 시 필요 |
| 이메일 인증/초대 메일 | 미구현 | 외부 SMTP 의존을 피함 |
| 소프트 삭제 데이터의 물리 삭제 배치 | 미구현 | 운영 정책에 맞춰 추가 |
| 노출(impressions) 지표 | N/A | 플랫폼 API 연동 후 채움 |

## 9. 검증 실행 기록 (2026-09-16)

| 검사 | 명령 | 결과 |
| --- | --- | --- |
| Lint | `npm run lint` | 0 errors, 0 warnings |
| Typecheck | `npm run typecheck` (next typegen + tsc strict) | 통과 |
| 단위·통합 테스트 | `npm run test` | 15 files, 48 tests 통과 (DB 통합 1건 포함) |
| Build | `npm run build` | 통과 (Turbopack tracing 경고 5건: 동적 스토리지/폰트 경로, 무해) |
| E2E | `npm run test:e2e` | 11 tests 통과 (MVP 18단계 시나리오 포함) |

검증 환경: Node 22, PostgreSQL 16(로컬), Chromium 141, ffmpeg-static 7.0.1, Mock AI/TTS/Publisher.
