import type { Page } from "@playwright/test";

/** 클라이언트 폼이 hydration될 때까지 대기 (네이티브 submit 방지) */
export async function waitForForm(page: Page) {
  await page.locator('form[data-hydrated="true"]').first().waitFor({ state: "attached", timeout: 60_000 });
}

export function uniqueUser(prefix = "e2e") {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { name: `${prefix} 사용자`, email: `${prefix}-${id}@example.com`, password: "password123!", slug: `${prefix}-${id}` };
}

export async function signupAndCreateWorkspace(page: Page, user = uniqueUser()) {
  await page.goto("/signup");
  await waitForForm(page);
  await page.getByLabel("이름").fill(user.name);
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호").fill(user.password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL("**/onboarding**");
  await waitForForm(page);
  await page.getByLabel("이름").fill("배당 계산기 팀");
  await page.getByLabel("URL 슬러그").fill(user.slug);
  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();
  await page.waitForURL(`**/w/${user.slug}`);
  return user;
}

export async function registerProduct(page: Page, base: string) {
  await page.goto(`${base}/products/new`);
  await waitForForm(page);
  await page.getByLabel("제품 이름").fill("배당 계산기");
  await page.getByLabel("서비스 URL").fill("https://dividend.example.com");
  await page.getByLabel("설명").fill("목표 배당금에 필요한 투자금을 계산해 주는 서비스");
  await page.getByRole("button", { name: "등록하고 분석하기" }).click();
  await page.waitForURL(`**${base}/products/*?step=analyze`);
}
