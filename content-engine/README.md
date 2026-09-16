# Content Engine

웹서비스 운영자가 제품 URL과 브랜드 정보를 등록하면 AI가 소재를 찾고, 검증된 Content Master를 만든 뒤
Threads · Instagram 카드뉴스 · 블로그 · YouTube Shorts로 변환·렌더링·승인·게시·측정까지 지원하는 SaaS.

설계 문서: [`../docs/IMPLEMENTATION_PLAN.md`](../docs/IMPLEMENTATION_PLAN.md), [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)

## 로컬 실행

```bash
cd content-engine
cp .env.example .env            # AUTH_SECRET, ENCRYPTION_KEY 값을 채우세요 (openssl rand -base64 32)
docker compose up -d            # PostgreSQL 16
npm install
npm run db:migrate              # 마이그레이션 적용 + Prisma Client 생성
npm run db:seed                 # (선택) demo@example.com / demo1234!
npm run dev                     # http://localhost:3000
```

외부 API 키가 없어도 동작합니다. 기본값은 모두 Mock Provider(`AI_PROVIDER=mock`, `TTS_PROVIDER=mock`,
`THREADS_PUBLISHER=mock`)입니다.

## 검증 명령

```bash
npm run lint
npm run typecheck
npm run test          # Vitest 단위 테스트
npm run build
npm run test:e2e      # Playwright (DB 필요, 포트 3100에 dev 서버 자동 실행)
```

Playwright 브라우저가 별도 경로에 있으면 `CHROMIUM_PATH=/path/to/chrome npm run test:e2e`.

## 구조 요약

- `src/app` App Router 페이지 (`/w/[slug]/...` 워크스페이스 영역)
- `src/server` 서버 전용 코드 (auth, tenancy, providers, content, render, publish, analytics, jobs, security)
- `src/lib` 공용 유틸과 Zod 스키마
- `prisma` 스키마와 마이그레이션
- `tests/unit`, `tests/e2e`

## 안전 원칙

- 사용자 승인(APPROVED) 없이는 어떤 채널에도 게시하지 않으며, 서버에서 상태를 다시 확인합니다.
- 금융 콘텐츠는 기준일과 출처를 저장하고, 안전 검사에 걸린 콘텐츠는 게시가 차단됩니다.
- 비밀정보는 환경변수로만 관리합니다.
