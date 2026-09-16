import { test, expect, type Page } from "@playwright/test";
import { registerProduct, signupAndCreateWorkspace, waitForForm } from "./helpers";

async function createCalcMasterWithChannels(page: Page, base: string) {
  await page.goto(`${base}/topics`);
  await waitForForm(page);
  await page.getByLabel("월 목표 배당금 (원)").fill("500000");
  await page.getByRole("button", { name: "계산 소재 추가" }).click();
  await page.getByRole("button", { name: "선택", exact: true }).first().click();
  await page.getByRole("button", { name: "Content Master 생성" }).click();
  await page.waitForURL(`**${base}/content/*`);
  await page.getByRole("checkbox", { name: /YouTube/ }).check();
  await page.getByRole("button", { name: "선택한 채널 생성" }).click();
  await expect(page.getByText("채널 콘텐츠를 생성했습니다")).toBeVisible();
  return page.url();
}

test.describe.configure({ mode: "serial" });

test("Threads 수정 → 새 버전 + 검증 + 브랜드 학습 / 카드뉴스 PNG 렌더 + ZIP / 블로그 Markdown / Shorts MP4", async ({ page }) => {
  test.setTimeout(240_000);
  const user = await signupAndCreateWorkspace(page);
  const base = `/w/${user.slug}`;
  await registerProduct(page, base);
  const masterUrl = await createCalcMasterWithChannels(page, base);

  // ---- Threads 편집 ----
  await page.getByRole("link", { name: "열기" }).first().click();
  await page.waitForURL(`${masterUrl}/*`);
  await page.locator("[data-workbench][data-hydrated='true']").waitFor();
  const textarea = page.getByLabel(/^본문/);
  const original = await textarea.inputValue();
  await textarea.fill(original.replace("얼마가 필요할까요?", "얼마가 필요할까요? (직접 수정)"));
  await page.getByRole("button", { name: "저장 (새 버전)" }).click();
  await expect(page.getByText("v2 저장했습니다")).toBeVisible();
  await expect(page.getByText(/버전 이력: v2\(USER\)/)).toBeVisible();

  // 금지 표현을 넣으면 BLOCK
  await textarea.fill(original + "\n무조건 오른다");
  await page.getByRole("button", { name: "저장 (새 버전)" }).click();
  await expect(page.getByText(/검증 이슈가 있어 승인할 수 없습니다/)).toBeVisible();
  await expect(page.getByText("브랜드 금지 표현").first()).toBeVisible();

  await page.goto(`${base}/learning`);
  await expect(page.getByText(/표현을 다듬음|문장을 더 짧게|느낌표|이모지/).first()).toBeVisible();

  // ---- Instagram 렌더 ----
  await page.goto(masterUrl);
  await page.getByRole("listitem").filter({ hasText: "Instagram 카드뉴스" }).getByRole("link", { name: "열기" }).click();
  await page.waitForURL(`${masterUrl}/*`);
  await page.locator("[data-workbench][data-hydrated='true']").waitFor();
  await page.getByRole("button", { name: "PNG 렌더링" }).click();
  await expect(page.getByText("렌더링을 시작했습니다")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("render-status")).toHaveAttribute("data-status", "SUCCEEDED", { timeout: 120_000 });
  await expect(page.getByText("card-01.png")).toBeVisible();
  await expect(page.getByText("cards.zip")).toBeVisible();
  const zipHref = await page.getByRole("listitem").filter({ hasText: "cards.zip" }).getByRole("link", { name: "다운로드" }).getAttribute("href");
  const zipRes = await page.request.get(zipHref!);
  expect(zipRes.status()).toBe(200);
  expect(zipRes.headers()["content-type"]).toContain("application/zip");
  const pngHref = await page.getByRole("listitem").filter({ hasText: "card-01.png" }).getByRole("link", { name: "다운로드" }).getAttribute("href");
  const pngRes = await page.request.get(pngHref!);
  expect(pngRes.headers()["content-type"]).toContain("image/png");
  const png = await pngRes.body();
  // PNG 헤더 + 1080x1350 (IHDR)
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1350);

  // ---- 블로그 Markdown ----
  await page.goto(masterUrl);
  await page.getByRole("listitem").filter({ hasText: "블로그" }).getByRole("link", { name: "열기" }).click();
  await page.waitForURL(`${masterUrl}/*`);
  const mdHref = await page.getByRole("link", { name: "Markdown 다운로드" }).getAttribute("href");
  const md = await page.request.get(mdHref!);
  expect(md.status()).toBe(200);
  const mdText = await md.text();
  expect(mdText).toContain("# ");
  expect(mdText).toContain("1억 5,000만 원");
  expect(mdText).toContain("기준일:");

  // ---- Shorts MP4 ----
  await page.goto(masterUrl);
  await page.getByRole("listitem").filter({ hasText: "YouTube Shorts" }).getByRole("link", { name: "열기" }).click();
  await page.waitForURL(`${masterUrl}/*`);
  await page.locator("[data-workbench][data-hydrated='true']").waitFor();
  await page.getByRole("button", { name: "MP4 렌더링" }).click();
  await expect(page.getByText("렌더링을 시작했습니다")).toBeVisible({ timeout: 180_000 });
  await expect(page.getByTestId("render-status")).toHaveAttribute("data-status", "SUCCEEDED", { timeout: 180_000 });
  await expect(page.getByText("shorts.mp4")).toBeVisible();
  await expect(page.getByText("subtitles.srt")).toBeVisible();
  const mp4Href = await page.getByRole("listitem").filter({ hasText: "shorts.mp4" }).getByRole("link", { name: "다운로드" }).getAttribute("href");
  const mp4 = await page.request.get(mp4Href!);
  expect(mp4.headers()["content-type"]).toContain("video/mp4");
  const buf = await mp4.body();
  expect(buf.length).toBeGreaterThan(50_000);
  expect(buf.subarray(4, 8).toString()).toBe("ftyp");

  await page.goto(`${base}/renders`);
  await expect(page.getByText("Shorts MP4").first()).toBeVisible();
});
