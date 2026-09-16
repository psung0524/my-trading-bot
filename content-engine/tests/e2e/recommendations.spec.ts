import { test, expect } from "@playwright/test";
import { registerProduct, signupAndCreateWorkspace, waitForForm } from "./helpers";

test("성과 데이터 → 추천 생성(이유·지표) → 승인 시 후속 소재 생성", async ({ page }) => {
  test.setTimeout(180_000);
  const user = await signupAndCreateWorkspace(page);
  const base = `/w/${user.slug}`;
  await registerProduct(page, base);
  await page.goto(`${base}/channels`);
  await page.getByRole("button", { name: "Mock 계정 연결" }).first().click();
  await expect(page.getByTestId("channel-account").first()).toBeVisible();

  await page.goto(`${base}/topics`);
  await waitForForm(page);
  await page.getByLabel("월 목표 배당금 (원)").fill("500000");
  await page.getByRole("button", { name: "계산 소재 추가" }).click();
  await page.getByRole("button", { name: "선택", exact: true }).first().click();
  await page.getByRole("button", { name: "Content Master 생성" }).click();
  await page.waitForURL(`**${base}/content/*`);
  for (const l of [/Instagram/, /블로그/, /YouTube/]) await page.getByLabel(l).uncheck();
  await page.getByRole("button", { name: "선택한 채널 생성" }).click();
  await expect(page.getByText("채널 콘텐츠를 생성했습니다")).toBeVisible();
  await page.goto(`${base}/inbox`);
  await page.locator("[data-inbox][data-hydrated='true']").waitFor();
  await page.getByTestId("inbox-item").first().getByRole("button", { name: "승인 + 바로 게시" }).click();
  await expect(page.getByText("승인 후 게시했습니다")).toBeVisible({ timeout: 60_000 });

  await page.goto(`${base}/schedule`);
  const job = page.getByTestId("publish-job").first();
  await job.getByRole("button", { name: "로그" }).click();
  const code = (await job.locator("pre").innerText()).match(/추적 링크 적용: (\w+)/)![1];
  const workspaceId = await page.goto(`${base}/analytics`).then(async () => (await page.locator("pre").first().innerText()).match(/workspaceId: "([^"]+)"/)![1]);
  const res = await page.request.get(`/api/t/${code}`, { maxRedirects: 0 });
  const ccId = new URL(res.headers()["location"]).searchParams.get("utm_content")!;

  // 클릭 12회 + 방문/가입 이벤트 (익명 ID 다르게)
  for (let i = 0; i < 11; i++) await page.request.get(`/api/t/${code}`, { maxRedirects: 0 });
  const events = [];
  for (let i = 0; i < 8; i++) {
    const anon = `anon-${i}-abcdef`;
    events.push({ workspaceId, anonymousId: anon, sessionId: `s-${i}-abcdef`, eventName: "page_view", utm: { source: "threads", content: ccId } });
    if (i < 3) events.push({ workspaceId, anonymousId: anon, sessionId: `s-${i}-abcdef`, eventName: "signup_completed", utm: { content: ccId } });
    if (i < 2) events.push({ workspaceId, anonymousId: anon, sessionId: `s-${i}-abcdef`, eventName: "calculator_used", utm: { content: ccId } });
  }
  const c = await page.request.post("/api/collect", { data: { events } });
  expect(c.status()).toBe(200);
  // 개인정보 키는 거부
  const bad = await page.request.post("/api/collect", { data: { workspaceId, anonymousId: "anon-x-abcdef", sessionId: "s-x-abcdef", eventName: "page_view", properties: { email: "a@b.c" } } });
  expect(bad.status()).toBe(400);

  await page.goto(`${base}/analytics?days=7`);
  await page.getByRole("button", { name: "성과 분석으로 추천 생성" }).click();
  await expect(page.getByText(/추천 \d+개 생성/)).toBeVisible();
  const recs = page.getByTestId("recommendations");
  await expect(recs.locator('[data-kind="EXPAND_TOPIC"]').first()).toBeVisible();
  await expect(recs.locator('[data-kind="GOOD_CTA"]').first()).toContainText("계산하기");
  await expect(recs.locator('[data-kind="EXPAND_TOPIC"]').first()).toContainText("사용 지표");

  await recs.locator('[data-kind="EXPAND_TOPIC"]').first().getByRole("button", { name: "승인·반영" }).click();
  await expect(page.getByText(/후속 소재 생성/).first()).toBeVisible();
  await page.goto(`${base}/topics`);
  await expect(page.getByText(/— 후속/).first()).toBeVisible();

  await page.goto(base);
  await expect(page.getByRole("heading", { name: "오늘의 업무" })).toBeVisible();
  await expect(page.getByText("링크 클릭").first()).toBeVisible();
});
