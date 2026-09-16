# 운영 배포 가이드 (DEPLOYMENT)

기준일: 2026-09-16

## 1. 구성 요소

| 구성 | 역할 | 최소 사양 |
| --- | --- | --- |
| Web (Next.js) | UI, 서버 액션, API | Node 22, 1 vCPU / 1 GB |
| Worker (`npm run worker`) | 콘텐츠 생성·렌더링·게시 Job 처리 | Chromium + FFmpeg 실행 가능, 2 vCPU / 2 GB 권장 |
| PostgreSQL 16 | 데이터, Job 큐 | 관리형 DB 권장 |
| Storage | 렌더 결과물(PNG/MP4/ZIP) | S3 호환 버킷 |

Web과 Worker는 같은 이미지로 배포하고 실행 명령만 다르게 둔다. `JOB_RUNNER=worker`로 두면 Web은 Job을 큐에만 넣고 Worker가 처리한다.
(`JOB_RUNNER=inline`은 개발·데모용이다. 렌더링이 요청 안에서 실행되어 응답이 길어진다.)

## 2. 환경변수

`.env.example`을 기준으로 아래 값은 반드시 운영값으로 바꾼다.

| 변수 | 설명 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 연결 문자열 |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | OAuth 토큰 암호화 키, 32바이트 base64 |
| `AUTH_URL`, `APP_URL` | 공개 URL (https). 추적 링크·SDK·OAuth 콜백에 사용 |
| `JOB_RUNNER` | `worker` |
| `STORAGE_PROVIDER=s3` + `S3_*` | 결과물 저장 |
| `AI_PROVIDER` + `ANTHROPIC_API_KEY` 또는 `OPENAI_API_KEY` | 실제 AI. 키가 없으면 Mock |
| `TTS_PROVIDER=openai` | 실제 음성. 없으면 Mock(무음 톤) |
| `THREADS_APP_ID`, `THREADS_APP_SECRET` | Threads OAuth. 콜백 URL: `${APP_URL}/api/channels/threads/callback` |
| `CRON_SECRET` | `/api/jobs/tick` 호출 인증(워커 없이 크론으로 처리할 때) |
| `WEBHOOK_SECRET` | 웹훅 서명 검증 |
| `GA4_MEASUREMENT_ID`, `GA4_API_SECRET` | 선택. 이벤트를 GA4로도 전달 |
| `CHROMIUM_PATH`, `FFMPEG_PATH` | 시스템 바이너리를 쓸 때 |
| `RENDER_FONT_DIR` | 한글 폰트(Noto Sans KR TTF) 경로. 없으면 첫 렌더 때 Google Fonts에서 내려받아 `assets/fonts`에 저장 |

## 3. 컨테이너 이미지 (예시)

```dockerfile
FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
COPY content-engine/package*.json ./
RUN npm ci
COPY content-engine ./
RUN npm run fonts:download && npx prisma generate && npm run build
ENV NODE_ENV=production JOB_RUNNER=worker CHROMIUM_PATH=/ms-playwright/chromium-1194/chrome-linux/chrome
CMD ["npm", "run", "start"]
# worker 컨테이너: CMD ["npm", "run", "worker"]
```

Playwright 공식 이미지에는 Chromium과 필요한 시스템 라이브러리가 있다. FFmpeg는 `ffmpeg-static`이 포함되므로 별도 설치가 필요 없다.
Chromium 경로는 이미지 버전에 따라 다르므로 `npx playwright install chromium` 후 `CHROMIUM_PATH`를 맞춘다.

## 4. 배포 절차

1. `npx prisma migrate deploy`로 마이그레이션 적용 (배포 파이프라인의 릴리스 단계).
2. Web 컨테이너 기동 → `/`가 200인지 확인.
3. Worker 컨테이너 기동 → 로그에 `worker ... 시작. 핸들러: content.generate, render.cardnews, ...`가 찍히는지 확인.
4. 워크스페이스 설정에서 채널 계정을 연결하고, 승인함에서 테스트 콘텐츠를 Mock 계정으로 게시해 흐름을 확인.
5. 고객 서비스에 SDK 설치 코드(분석 화면)를 붙이고 `/api/collect`로 이벤트가 들어오는지 확인.

## 5. 운영 체크리스트

- [ ] `AUTH_SECRET`, `ENCRYPTION_KEY`가 개발 기본값이 아니다.
- [ ] `APP_URL`이 https이고 추적 링크가 외부에서 열린다.
- [ ] S3 버킷은 비공개이며 파일은 `/api/files/...`(멤버 인증)로만 서빙된다.
- [ ] Worker가 1개 이상 떠 있고, `Job` 테이블에 오래된 PROCESSING(10분 이상)이 없다.
- [ ] 예약 게시가 있는 경우 Worker 또는 크론(`POST /api/jobs/tick`, Bearer `CRON_SECRET`)이 1분 간격으로 돈다.
- [ ] Threads 토큰 만료 7일 전 자동 갱신 로그를 확인한다.
- [ ] 감사 로그(`/w/{slug}/audit`)에 게시·승인 기록이 남는다.

## 6. 백업과 데이터 삭제

- DB는 관리형 스냅샷을 사용한다. 스토리지는 버전 관리 버킷을 권장한다.
- 사용자 계정 삭제(설정 화면)는 소유 워크스페이스를 soft delete하고 계정을 익명화한다. 물리 삭제는 30일 후 배치로 처리하는 것을 권장한다(미구현, `deletedAt` 기준).

## 7. 확장 지점

| 항목 | 방법 |
| --- | --- |
| Queue를 Redis/BullMQ로 | `src/server/providers/queue/`에 `JobQueueProvider` 구현 추가 후 `getJobQueue()`에서 선택 |
| Rate limit을 Redis로 | `src/server/security/rate-limit.ts`의 `RateLimiter` 구현 교체 |
| 새 채널 Publisher | `src/server/providers/publish/`에 `PublisherProvider` 구현, `getPublisher()`에 연결 |
| 새 소재 소스 | `src/server/providers/topics/`에 `TopicSourceProvider` 구현 |
