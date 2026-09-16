import { test, expect } from "@playwright/test";
import { uniqueUser, waitForForm } from "./helpers";

/**
 * 완료 조건 §17 — 18단계 시나리오를 한 흐름으로 검증한다.
 */
test("MVP 완료 시나리오 18단계", async ({ page }) => {
  test.setTimeout(420_000);
  const user = uniqueUser("mvp");

  // 1. 회원가입
  await page.goto("/signup");
  await waitForForm(page);
  await page.getByLabel("이름").fill(user.name);
  await page.getByLabel("이메일").fill(user.email);
  await page.getByLabel("비밀번호").fill(user.password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL("**/onboarding**");

  // 2. 워크스페이스 생성
  await waitForForm(page);
  await page.getByLabel("이름").fill("배당 계산기 팀");
  await page.getByLabel("URL 슬러그").fill(user.slug);
  await page.getByRole("button", { name: "워크스페이스 만들기" }).click();
  const base = `/w/${user.slug}`;
  await page.waitForURL(`**${base}`);

  // 3. 배당주 서비스 정보 등록
  await page.getByRole("link", { name: "제품 등록하기" }).click();
  await waitForForm(page);
  await page.getByLabel("제품 이름").fill("배당 계산기");
  await page.getByLabel("서비스 URL").fill("https://dividend.example.com");
  await page.getByLabel("설명").fill("목표 배당금에 필요한 투자금을 계산해 주는 서비스");
  await page.getByRole("button", { name: "등록하고 분석하기" }).click();
  await page.waitForURL(`**${base}/products/*?step=analyze`);
  await page.getByRole("button", { name: "페이지 분석 실행" }).click();
  await expect(page.getByText("마지막 분석")).toBeVisible();

  // 4. 브랜드 말투와 금지 표현 설정
  await page.getByRole("link", { name: "다음: 브랜드 프로필" }).click();
  await waitForForm(page);
  await page.getByLabel("말투").fill("차분하고 쉬운 말투. 숫자에는 기준일과 조건을 붙인다.");
  await page.getByTestId("forbidden-input").fill("대박 종목");
  await page.getByTestId("forbidden-input").press("Enter");
  await page.getByRole("button", { name: "브랜드 프로필 저장" }).click();
  await expect(page.getByText("브랜드 프로필을 저장했습니다")).toBeVisible();

  // 채널 Mock 계정
  await page.goto(`${base}/channels`);
  await page.getByRole("button", { name: "Mock 계정 연결" }).first().click();
  await expect(page.getByTestId("channel-account").first()).toBeVisible();

  // 5. "월 50만 원 배당에 필요한 투자금" 소재 선택
  await page.goto(`${base}/topics`);
  await waitForForm(page);
  await page.getByLabel("월 목표 배당금 (원)").fill("500000");
  await page.getByLabel("배당수익률 시나리오 (%)").fill("3, 4, 5");
  await page.getByRole("button", { name: "계산 소재 추가" }).click();
  await expect(page.getByText("월 50만 원의 배당금을 받기 위해 필요한 투자금")).toBeVisible();
  await page.getByRole("button", { name: "선택", exact: true }).first().click();

  // 6. 검증된 Content Master 생성
  await page.getByRole("button", { name: "Content Master 생성" }).click();
  await page.waitForURL(`**${base}/content/*`);
  const masterUrl = page.url();
  await expect(page.getByText("검증을 통과했습니다.")).toBeVisible();
  await expect(page.getByText("2억 원").first()).toBeVisible();
  await expect(page.getByText("1억 5,000만 원").first()).toBeVisible();
  await expect(page.getByText("1억 2,000만 원").first()).toBeVisible();

  // 7~10. Threads 3종, Instagram 카드뉴스, 블로그, Shorts 대본·Storyboard 생성
  await page.getByRole("button", { name: "선택한 채널 생성" }).click();
  await expect(page.getByText("채널 콘텐츠를 생성했습니다")).toBeVisible();
  await expect(page.getByText("Threads · 정보형")).toBeVisible();
  await expect(page.getByText("Threads · 운영자 관찰형")).toBeVisible();
  await expect(page.getByText("Threads · 참여형")).toBeVisible();

  // 8. 카드뉴스 PNG 다운로드
  await page.getByRole("listitem").filter({ hasText: "Instagram 카드뉴스" }).getByRole("link", { name: "열기" }).click();
  await page.locator("[data-workbench][data-hydrated='true']").waitFor();
  await page.getByRole("button", { name: "PNG 렌더링" }).click();
  await expect(page.getByTestId("render-status")).toHaveAttribute("data-status", "SUCCEEDED", { timeout: 120_000 });
  const pngHref = await page.getByRole("listitem").filter({ hasText: "card-01.png" }).getByRole("link", { name: "다운로드" }).getAttribute("href");
  const png = await page.request.get(pngHref!);
  expect(png.headers()["content-type"]).toContain("image/png");
  expect((await png.body()).readUInt32BE(16)).toBe(1080);

  // 9. 블로그 Markdown 다운로드
  await page.goto(masterUrl);
  await page.getByRole("listitem").filter({ hasText: "블로그" }).getByRole("link", { name: "열기" }).click();
  const mdHref = await page.getByRole("link", { name: "Markdown 다운로드" }).getAttribute("href");
  const md = await page.request.get(mdHref!);
  expect(await md.text()).toContain("1억 5,000만 원");

  // 10~12. Shorts 대본/Storyboard → Mock TTS → 1080x1920 MP4
  await page.goto(masterUrl);
  await page.getByRole("listitem").filter({ hasText: "YouTube Shorts" }).getByRole("link", { name: "열기" }).click();
  await page.locator("[data-workbench][data-hydrated='true']").waitFor();
  await expect(page.getByText("장면 1")).toBeVisible();
  await page.getByRole("button", { name: "MP4 렌더링" }).click();
  await expect(page.getByTestId("render-status")).toHaveAttribute("data-status", "SUCCEEDED", { timeout: 240_000 });
  const mp4Href = await page.getByRole("listitem").filter({ hasText: "shorts.mp4" }).getByRole("link", { name: "다운로드" }).getAttribute("href");
  const mp4 = await page.request.get(mp4Href!);
  expect(mp4.headers()["content-type"]).toContain("video/mp4");
  expect((await mp4.body()).subarray(4, 8).toString()).toBe("ftyp");

  // 13. 사용자가 콘텐츠를 수정하고 승인
  await page.goto(masterUrl);
  await page.getByRole("listitem").filter({ hasText: "Threads · 정보형" }).getByRole("link", { name: "열기" }).click();
  await page.locator("[data-workbench][data-hydrated='true']").waitFor();
  const ta = page.getByLabel(/^본문/);
  await ta.fill((await ta.inputValue()).replace("얼마가 필요할까요?", "얼마가 필요할까요? 계산해 봤습니다."));
  await page.getByRole("button", { name: "저장 (새 버전)" }).click();
  await expect(page.getByText("v2 저장했습니다")).toBeVisible();
  await page.goto(`${base}/inbox`);
  await page.locator("[data-inbox][data-hydrated='true']").waitFor();
  const item = page.getByTestId("inbox-item").filter({ hasText: "v2" }).first();

  // 14. Mock Publisher로 게시
  await item.getByRole("button", { name: "승인 + 바로 게시" }).click();
  await expect(page.getByText("승인 후 게시했습니다")).toBeVisible({ timeout: 60_000 });
  await page.goto(`${base}/schedule`);
  const job = page.getByTestId("publish-job").first();
  await expect(job).toHaveAttribute("data-status", "SUCCEEDED");
  await job.getByRole("button", { name: "로그" }).click();
  const code = (await job.locator("pre").innerText()).match(/추적 링크 적용: ([\w-]+)/)![1];

  // 15. 추적 링크를 통해 방문 이벤트 기록
  const workspaceId = await page.goto(`${base}/analytics`).then(async () => (await page.locator("pre").first().innerText()).match(/workspaceId: "([^"]+)"/)![1]);
  const res = await page.request.get(`/api/t/${code}`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  const ccId = new URL(res.headers()["location"]).searchParams.get("utm_content")!;
  await page.goto(`/?utm_source=threads&utm_medium=social&utm_content=${ccId}`);
  await page.evaluate(({ wsId }) => { (window as unknown as { ceq: unknown[] }).ceq = [["init", { host: window.location.origin, workspaceId: wsId }]]; }, { wsId: workspaceId });
  await page.addScriptTag({ url: "/ce-sdk.js" });
  await page.waitForFunction(() => Boolean((window as unknown as { ce?: { __loaded: boolean } }).ce?.__loaded));

  // 16. 회원가입 완료 이벤트 기록
  await page.evaluate(() => { const ce = (window as unknown as { ce: { track: (n: string) => void; flush: () => void } }).ce; ce.track("signup_completed"); ce.track("calculator_used"); ce.flush(); });
  await page.waitForTimeout(1500);

  // 17. 대시보드에서 콘텐츠별 전환 성과 확인
  await page.goto(`${base}/analytics?days=7`);
  const funnel = page.getByLabel("전환 퍼널");
  await expect(funnel.getByText("링크 클릭").locator("..").getByText("1", { exact: true })).toBeVisible();
  await expect(funnel.getByText("회원가입").locator("..").getByText("1", { exact: true })).toBeVisible();
  await expect(page.getByText(/월 50만 원의 배당금을 받기 위해 필요한 투자금 · Threads/).first()).toBeVisible();
  await page.goto(base);
  await expect(page.getByText("링크 클릭").locator("..").getByText("1", { exact: true })).toBeVisible();

  // 18. 시스템이 다음 콘텐츠 추천을 생성
  await page.getByRole("button", { name: "성과 분석으로 추천 생성" }).click();
  await expect(page.getByText(/추천 \d+개 생성/)).toBeVisible();
  await expect(page.getByTestId("recommendations").locator("li").first()).toBeVisible();
});
