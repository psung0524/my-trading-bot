import { test, expect } from "@playwright/test";
import { signupAndCreateWorkspace, uniqueUser, waitForForm } from "./helpers";

test("회원가입 → 워크스페이스 생성 → 로그아웃 → 로그인", async ({ page }) => {
  const user = uniqueUser();
  await signupAndCreateWorkspace(page, user);
  await expect(page.getByRole("heading", { name: "오늘의 업무" })).toBeVisible();
  await expect(page.getByText("먼저 제품을 등록하세요")).toBeVisible();

  await page.getByRole("button", { name: "로그아웃" }).first().click();
  await page.waitForURL("**/");

  await page.goto(`/w/${user.slug}`);
  await page.waitForURL("**/login**");
  await waitForForm(page);
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호").fill(user.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL(`**/w/${user.slug}`);
  await expect(page.getByRole("heading", { name: "오늘의 업무" })).toBeVisible();
});

test("다른 사용자의 워크스페이스에는 접근할 수 없다", async ({ page, browser }) => {
  const owner = await signupAndCreateWorkspace(page);
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  const other = uniqueUser("other");
  await signupAndCreateWorkspace(page2, other);
  await page2.goto(`/w/${owner.slug}`);
  await page2.waitForURL("**/onboarding?error=forbidden");
  await expect(page2.getByText("접근 권한이 없는 워크스페이스입니다.")).toBeVisible();
  await ctx2.close();
});

test("잘못된 로그인은 거부된다", async ({ page }) => {
  await page.goto("/login");
  await waitForForm(page);
  await page.getByLabel("이메일").fill("nobody@example.com");
  await page.getByLabel("비밀번호").fill("wrongpass");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByText("이메일 또는 비밀번호가 올바르지 않습니다")).toBeVisible();
});
