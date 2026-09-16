import { test, expect } from "@playwright/test";
import { registerProduct, signupAndCreateWorkspace, waitForForm } from "./helpers";

test("배치 생성: 제출 → 지금 확인 → 채널 콘텐츠 생성 (Threads 1편, 블로그 1,500자 기본)", async ({ page }) => {
  test.setTimeout(180_000);
  const user = await signupAndCreateWorkspace(page);
  const base = `/w/${user.slug}`;
  await registerProduct(page, base);

  await page.goto(`${base}/topics`);
  await waitForForm(page);
  await page.getByLabel("월 목표 배당금 (원)").fill("500000");
  await page.getByRole("button", { name: "계산 소재 추가" }).click();
  await page.getByRole("button", { name: "선택", exact: true }).first().click();
  await page.getByRole("button", { name: "Content Master 생성" }).click();
  await page.waitForURL(`**${base}/content/*`);

  // 기본값: Shorts 체크 해제, Threads 1편, 블로그 1,500자
  await expect(page.getByRole("checkbox", { name: /YouTube/ })).not.toBeChecked();
  await expect(page.getByLabel("글 수")).toHaveValue("1");
  await expect(page.getByLabel("블로그 길이")).toHaveValue("1500");

  await page.getByLabel("생성 방식").selectOption("batch");
  await page.getByRole("button", { name: "선택한 채널 생성" }).click();
  await expect(page.getByText("배치를 제출했습니다")).toBeVisible();

  // 회수 Job은 2분 뒤로 예약되므로 "지금 확인"으로 가져온다 (Mock 배치는 즉시 끝남)
  const status = page.locator("[data-batch-status]");
  await expect(status).toBeVisible();
  await status.getByRole("button", { name: "지금 확인" }).click();
  await expect(page.getByText("배치 결과를 가져왔습니다")).toBeVisible({ timeout: 60_000 });

  await expect(page.getByText("Threads · 정보형")).toBeVisible();
  await expect(page.getByText("Threads · 운영자 관찰형")).toHaveCount(0);
  await expect(page.getByText(/카드뉴스/).first()).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "블로그" }).first()).toBeVisible();
  await expect(page.locator("[data-batch-status]")).toHaveCount(0);

  // Threads 편집 화면: 훅 각도와 답글 문구가 있다
  await page.getByRole("listitem").filter({ hasText: "Threads · 정보형" }).getByRole("link", { name: "열기" }).click();
  await expect(page.getByText(/훅 각도:/)).toBeVisible();
  await expect(page.getByLabel(/답글 문구/)).toHaveValue(/https:\/\//);
});
