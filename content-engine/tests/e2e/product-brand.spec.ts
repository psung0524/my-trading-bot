import { test, expect } from "@playwright/test";
import { signupAndCreateWorkspace, waitForForm } from "./helpers";

test("제품 등록 → 분석 → 브랜드 프로필 저장 → 대시보드 추천 행동", async ({ page }) => {
  const user = await signupAndCreateWorkspace(page);
  const base = `/w/${user.slug}`;

  await page.getByRole("link", { name: "제품 등록하기" }).click();
  await page.waitForURL(`**${base}/products/new`);
  await waitForForm(page);
  await page.getByLabel("제품 이름").fill("배당 계산기");
  await page.getByLabel("서비스 URL").fill("https://dividend.example.com");
  await page.getByLabel("설명").fill("목표 배당금에 필요한 투자금을 계산해 주는 서비스");
  await page.getByRole("button", { name: "등록하고 분석하기" }).click();
  await page.waitForURL(`**${base}/products/*?step=analyze`);

  await page.getByRole("button", { name: "페이지 분석 실행" }).click();
  await expect(page.getByText("마지막 분석")).toBeVisible();
  await expect(page.getByLabel("핵심 기능 (줄바꿈으로 구분)")).not.toHaveValue("");

  await page.getByRole("link", { name: "다음: 브랜드 프로필" }).click();
  await page.waitForURL(`**${base}/brand?product=*`);
  await waitForForm(page);
  await expect(page.getByLabel("브랜드명")).toHaveValue("배당 계산기");
  await expect(page.getByText("무조건 오른다").first()).toBeVisible();

  await page.getByTestId("forbidden-input").fill("대박 종목");
  await page.getByTestId("forbidden-input").press("Enter");
  await expect(page.getByText("대박 종목").first()).toBeVisible();
  await page.getByLabel("말투").fill("차분하고 쉬운 말투. 숫자에는 기준일을 붙인다.");
  await page.getByRole("button", { name: "브랜드 프로필 저장" }).click();
  await expect(page.getByText("브랜드 프로필을 저장했습니다")).toBeVisible();

  await page.reload();
  await waitForForm(page);
  await expect(page.getByText("대박 종목").first()).toBeVisible();

  await page.getByLabel("규칙 내용").fill("숫자는 천 단위 구분자를 쓴다");
  await page.getByRole("button", { name: "추가" }).last().click();
  await expect(page.getByText("숫자는 천 단위 구분자를 쓴다")).toBeVisible();

  await page.goto(base);
  await expect(page.getByRole("heading", { name: "오늘의 업무" })).toBeVisible();
  await expect(page.getByText("콘텐츠 소재 만들기")).toBeVisible();
});
