import { test, expect } from "@playwright/test";
import { registerProduct, signupAndCreateWorkspace } from "./helpers";

test("참고 글 붙여넣기 → 문체 분석 → 가이드 저장", async ({ page }) => {
  const user = await signupAndCreateWorkspace(page);
  const base = `/w/${user.slug}`;
  await registerProduct(page, base);
  await page.goto(`${base}/brand`);
  await page.getByRole("link", { name: "참고 글·문체" }).click();
  await page.waitForURL("**/brand/references**");
  await page.locator("[data-references][data-hydrated='true']").waitFor();
  const text = "월배당 ETF를 처음 살 때 저도 배당수익률만 봤어요. 그런데 몇 달 지나 보니 숫자보다 먼저 정해야 할 게 있더라고요. 바로 매달 얼마를 받고 싶은지였죠. 목표가 없으면 비교 기준도 없습니다. 그래서 저는 계산기를 만들었고, 직접 넣어 보니 생각보다 필요한 돈이 컸어요. 이 글에서는 그 과정을 정리합니다. 정리하면, 목표 금액부터 정하고 그다음에 종목을 보는 순서가 맞습니다.";
  await page.getByLabel("본문").fill(text);
  await page.getByLabel("메모 (예: 조회수 높았던 글)").fill("조회수 높았던 글");
  await page.getByRole("button", { name: "등록", exact: true }).click();
  await expect(page.getByTestId("reference-item")).toHaveCount(1);
  await page.getByRole("button", { name: "참고 글로 문체 분석" }).click();
  await expect(page.getByText("문체 가이드를 만들었습니다")).toBeVisible();
  await expect(page.getByLabel("화자·말투")).not.toHaveValue("");
  await page.getByLabel("한 줄 요약").fill("친근한 1인칭, 짧은 문장");
  await page.getByRole("button", { name: "가이드 저장" }).click();
  await expect(page.getByText("저장했습니다")).toBeVisible();
});
