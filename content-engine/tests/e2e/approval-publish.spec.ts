import { test, expect, type Page } from "@playwright/test";
import { registerProduct, signupAndCreateWorkspace, waitForForm } from "./helpers";

async function createCalcMasterWithThreads(page: Page, base: string) {
  await page.goto(`${base}/topics`);
  await waitForForm(page);
  await page.getByLabel("월 목표 배당금 (원)").fill("500000");
  await page.getByRole("button", { name: "계산 소재 추가" }).click();
  await page.getByRole("button", { name: "선택", exact: true }).first().click();
  await page.getByRole("button", { name: "Content Master 생성" }).click();
  await page.waitForURL(`**${base}/content/*`);
  // Threads만 3편 생성 (게시·승인·예약을 각각 다른 항목으로 검증)
  for (const l of [/Instagram/, /^블로그/, /YouTube/]) await page.getByRole("checkbox", { name: l }).uncheck();
  await page.getByLabel("글 수").selectOption("3");
  await page.getByRole("button", { name: "선택한 채널 생성" }).click();
  await expect(page.getByText("채널 콘텐츠를 생성했습니다")).toBeVisible();
}

test("승인함: 승인 → Mock 게시(외부 ID/URL 저장) → 추적 링크 클릭 기록 / 미승인·수정본 게시 차단 / 예약 게시", async ({ page }) => {
  test.setTimeout(180_000);
  const user = await signupAndCreateWorkspace(page);
  const base = `/w/${user.slug}`;
  await registerProduct(page, base);

  // Mock 채널 계정 연결
  await page.goto(`${base}/channels`);
  await page.getByRole("button", { name: "Mock 계정 연결" }).first().click();
  await expect(page.getByTestId("channel-account").first()).toContainText("mock");

  await createCalcMasterWithThreads(page, base);

  await page.goto(`${base}/inbox`);
  await page.locator("[data-inbox][data-hydrated='true']").waitFor();
  await expect(page.getByTestId("inbox-item")).toHaveCount(3);

  // 1) 승인 + 바로 게시
  const first = page.getByTestId("inbox-item").first();
  await first.getByRole("button", { name: "승인 + 바로 게시" }).click();
  await expect(page.getByText("승인 후 게시했습니다")).toBeVisible({ timeout: 60_000 });
  await page.goto(`${base}/schedule`);
  const job = page.getByTestId("publish-job").first();
  await expect(job).toHaveAttribute("data-status", "SUCCEEDED");
  await expect(job.getByText(/threads\.net/)).toBeVisible();
  await expect(job.getByText(/ID mock_threads/)).toBeVisible();

  // 추적 링크가 만들어졌고 클릭하면 리다이렉트 + 이벤트 기록
  const logText = await job.getByRole("button", { name: "로그" }).click().then(() => job.locator("pre").innerText());
  const code = logText.match(/추적 링크 적용: ([\w-]+)/)?.[1];
  expect(code).toBeTruthy();
  const res = await page.request.get(`/api/t/${code}`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const loc = res.headers()["location"];
  expect(loc).toContain("utm_source=threads");
  expect(loc).toContain("utm_content=");

  // 2) 승인 없이 게시 시도 → 서버 거부 (승인함에서 두 번째 항목은 NEEDS_REVIEW)
  await page.goto(`${base}/inbox`);
  await page.locator("[data-inbox][data-hydrated='true']").waitFor();
  const second = page.getByTestId("inbox-item").filter({ has: page.getByRole("button", { name: "승인", exact: true }) }).first();
  await second.getByRole("button", { name: "승인", exact: true }).click();
  await expect(page.getByText("승인했습니다")).toBeVisible();
  // 승인된 항목을 열어 수정 → 버전 불일치로 게시 거부되어야 함
  const approved = page.getByTestId("inbox-item").filter({ hasText: "승인됨" }).first();
  await approved.getByRole("link", { name: "열어서 수정" }).click();
  await page.locator("[data-workbench][data-hydrated='true']").waitFor();
  const ta = page.getByLabel(/^본문/);
  await ta.fill((await ta.inputValue()) + "\n(수정)");
  await page.getByRole("button", { name: "저장 (새 버전)" }).click();
  await expect(page.getByText(/v2 저장했습니다/)).toBeVisible();
  // 수정 후 상태는 NEEDS_REVIEW로 돌아가 승인 없이는 게시 버튼이 없다
  await page.goto(`${base}/inbox`);
  await page.locator("[data-inbox][data-hydrated='true']").waitFor();
  await expect(page.getByTestId("inbox-item").filter({ hasText: "v2" }).first()).toHaveAttribute("data-status", "NEEDS_REVIEW");

  // 3) 예약 게시: 세 번째 항목을 미래 시각으로 예약 → SCHEDULED, Job QUEUED
  const third = page.locator('[data-testid="inbox-item"][data-status="NEEDS_REVIEW"]').filter({ hasText: "v1" }).first();
  await third.getByLabel("예약 시각").fill("2030-01-01T09:00");
  await third.getByRole("button", { name: "승인 + 예약" }).click();
  await expect(page.getByText("예약했습니다")).toBeVisible();
  await page.goto(`${base}/schedule`);
  await expect(page.getByTestId("publish-job").filter({ hasText: "QUEUED" }).first()).toBeVisible();
  await expect(page.getByText(/예약 2030/).first()).toBeVisible();
  await page.getByTestId("publish-job").filter({ hasText: "QUEUED" }).first().getByRole("button", { name: "게시 취소" }).click();
  await expect(page.getByText("예약을 취소했습니다")).toBeVisible();

  await page.goto(`${base}/audit`);
  await expect(page.getByText("content.publish", { exact: true }).first()).toBeVisible();
  await page.goto(`${base}/calendar`);
  await expect(page.getByRole("heading", { name: "주간 콘텐츠 캘린더" })).toBeVisible();
});
