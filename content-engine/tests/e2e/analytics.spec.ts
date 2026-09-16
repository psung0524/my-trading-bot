import { test, expect } from "@playwright/test";
import { registerProduct, signupAndCreateWorkspace, waitForForm } from "./helpers";

test("추적 링크 클릭 → SDK page_view/signup_completed 귀속 → 분석 대시보드 표시", async ({ page }) => {
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
  for (const l of [/Instagram/, /^블로그/, /YouTube/]) await page.getByRole("checkbox", { name: l }).uncheck();
  await page.getByRole("button", { name: "선택한 채널 생성" }).click();
  await expect(page.getByText("채널 콘텐츠를 생성했습니다")).toBeVisible();

  await page.goto(`${base}/inbox`);
  await page.locator("[data-inbox][data-hydrated='true']").waitFor();
  await page.getByTestId("inbox-item").first().getByRole("button", { name: "승인 + 바로 게시" }).click();
  await expect(page.getByText("승인 후 게시했습니다")).toBeVisible({ timeout: 60_000 });

  // 추적 링크 코드 추출
  await page.goto(`${base}/schedule`);
  const job = page.getByTestId("publish-job").first();
  await job.getByRole("button", { name: "로그" }).click();
  const code = (await job.locator("pre").innerText()).match(/추적 링크 적용: ([\w-]+)/)?.[1];
  expect(code).toBeTruthy();

  // 클릭 (리다이렉트 목적지의 utm_content가 콘텐츠 ID)
  const res = await page.request.get(`/api/t/${code}`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const dest = new URL(res.headers()["location"]);
  const ccId = dest.searchParams.get("utm_content")!;

  // 고객 서비스 페이지를 흉내: 같은 오리진의 랜딩 페이지에 UTM 붙여 방문 후 SDK 실행
  const workspaceId = await page.goto(`${base}/analytics`).then(async () => {
    const txt = await page.locator("pre").first().innerText();
    return txt.match(/workspaceId: "([^"]+)"/)![1];
  });
  await page.goto(`/?utm_source=threads&utm_medium=social&utm_campaign=test&utm_content=${ccId}`);
  await page.evaluate(({ wsId }) => {
    (window as unknown as { ceq: unknown[] }).ceq = [["init", { host: window.location.origin, workspaceId: wsId }]];
  }, { wsId: workspaceId });
  await page.addScriptTag({ url: "/ce-sdk.js" });
  await page.waitForFunction(() => Boolean((window as unknown as { ce?: { __loaded: boolean } }).ce?.__loaded));
  await page.evaluate(() => {
    const ce = (window as unknown as { ce: { track: (n: string, p?: object) => void; flush: () => void } }).ce;
    ce.track("signup_started");
    ce.track("signup_completed");
    ce.track("calculator_used", { tool: "dividend" });
    ce.flush();
  });
  await page.waitForTimeout(1500);

  await page.goto(`${base}/analytics?days=7`);
  await expect(page.getByRole("heading", { name: "분석 대시보드" })).toBeVisible();
  const funnel = page.getByLabel("전환 퍼널");
  await expect(funnel.getByText("링크 클릭").locator("..").getByText("1", { exact: true })).toBeVisible();
  await expect(funnel.getByText("회원가입").locator("..").getByText("1", { exact: true })).toBeVisible();
  await expect(funnel.getByText("핵심 기능 사용").locator("..").getByText("1", { exact: true })).toBeVisible();
  await expect(page.getByText("N/A").first()).toBeVisible();
  // 콘텐츠별 성과에 귀속
  await expect(page.getByText(/월 50만 원의 배당금을 받기 위해 필요한 투자금 · Threads/).first()).toBeVisible();
});
