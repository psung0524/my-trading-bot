import { test, expect, type Page } from "@playwright/test";
import { signupAndCreateWorkspace, waitForForm } from "./helpers";

export async function registerProduct(page: Page, base: string) {
  await page.goto(`${base}/products/new`);
  await waitForForm(page);
  await page.getByLabel("제품 이름").fill("배당 계산기");
  await page.getByLabel("서비스 URL").fill("https://dividend.example.com");
  await page.getByLabel("설명").fill("목표 배당금에 필요한 투자금을 계산해 주는 서비스");
  await page.getByRole("button", { name: "등록하고 분석하기" }).click();
  await page.waitForURL(`**${base}/products/*?step=analyze`);
}

test("계산 소재 → Content Master → 4채널 생성 → 미리보기", async ({ page }) => {
  const user = await signupAndCreateWorkspace(page);
  const base = `/w/${user.slug}`;
  await registerProduct(page, base);

  await page.goto(`${base}/topics`);
  await waitForForm(page);
  await page.getByLabel("월 목표 배당금 (원)").fill("500000");
  await page.getByLabel("배당수익률 시나리오 (%)").fill("3, 4, 5");
  await page.getByRole("button", { name: "계산 소재 추가" }).click();
  await expect(page.getByText("월 50만 원의 배당금을 받기 위해 필요한 투자금")).toBeVisible();

  await page.getByRole("button", { name: "선택", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Content Master 생성" })).toBeVisible();
  await page.getByRole("button", { name: "Content Master 생성" }).click();
  await page.waitForURL(`**${base}/content/*`);

  await expect(page.getByText("검증을 통과했습니다.")).toBeVisible();
  await expect(page.getByText("1억 5,000만 원").first()).toBeVisible();
  await expect(page.getByText("2억 원").first()).toBeVisible();

  await page.getByRole("button", { name: "선택한 채널 생성" }).click();
  await expect(page.getByText("채널 콘텐츠를 생성했습니다")).toBeVisible();
  await expect(page.getByText("Threads · 정보형")).toBeVisible();
  await expect(page.getByText("Threads · 운영자 관찰형")).toBeVisible();
  await expect(page.getByText("Threads · 참여형")).toBeVisible();
  await expect(page.getByText("Instagram 카드뉴스", { exact: true })).toBeVisible();
  await expect(page.getByText("블로그", { exact: true })).toBeVisible();
  await expect(page.getByText("YouTube Shorts", { exact: true })).toBeVisible();

  const masterUrl = page.url();
  await page.getByRole("link", { name: "열기" }).first().click();
  await page.waitForURL(`${masterUrl}/*`);
  await expect(page.getByText("Content Master와 일치하며 안전 검사를 통과했습니다.")).toBeVisible();
  await expect(page.getByText("월 50만 원 배당을 받으려면")).toBeVisible();

  await page.goto(`${base}/content`);
  await expect(page.getByText("월 50만 원의 배당금을 받기 위해 필요한 투자금")).toBeVisible();
});

test("출처 없는 질문 소재는 NEEDS_SOURCE로 막히고, 보완 후 생성 가능", async ({ page }) => {
  const user = await signupAndCreateWorkspace(page);
  const base = `/w/${user.slug}`;
  await registerProduct(page, base);

  await page.goto(`${base}/topics`);
  await waitForForm(page);
  await page.getByRole("tab", { name: "사용자 질문" }).click();
  await page.getByRole("textbox", { name: "사용자 질문" }).fill("배당락일 전에 사면 배당을 받을 수 있나요?");
  await page.getByRole("button", { name: "질문 소재 추가" }).click();
  await expect(page.getByText("배당락일 전에 사면 배당을 받을 수 있나요", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "선택", exact: true }).first().click();
  await page.getByRole("button", { name: "Content Master 생성" }).click();
  await page.waitForURL(`**${base}/content/*`);
  await expect(page.getByText("출처 필요").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "출처 보완 후 생성 가능" })).toBeDisabled();

  await page.getByLabel("핵심 수치(출처 필요) 값").fill("2영업일");
  await page.getByLabel("핵심 수치(출처 필요) 출처").fill("한국거래소 결제 제도 안내");
  await page.getByRole("button", { name: "출처 확인" }).click();
  await page.getByRole("button", { name: "저장하고 재검증" }).click();
  await expect(page.getByText("저장했습니다")).toBeVisible();
  await expect(page.getByRole("button", { name: "선택한 채널 생성" })).toBeEnabled();
});
