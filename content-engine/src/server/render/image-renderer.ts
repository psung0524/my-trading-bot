import { chromium, type Browser } from "playwright-core";
import { FONT_FACE_CSS, loadFontBuffers } from "./fonts";

/**
 * HTML → PNG 렌더러 (Playwright Chromium). 브라우저는 프로세스 내에서 재사용한다.
 * 폰트는 page.route로 가상 URL에서 제공해 시스템 폰트 없이도 한글이 렌더링된다.
 */
const g = globalThis as unknown as { renderBrowser?: Promise<Browser> };

async function getBrowser(): Promise<Browser> {
  if (!g.renderBrowser) {
    g.renderBrowser = chromium
      .launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"] })
      .then((b) => {
        b.on("disconnected", () => {
          g.renderBrowser = undefined;
        });
        return b;
      });
    g.renderBrowser.catch(() => {
      g.renderBrowser = undefined;
    });
  }
  return g.renderBrowser;
}

export type RenderResult = { png: Buffer; overflow: boolean; overflowSelectors: string[] };

export function wrapDocument(bodyHtml: string, extraCss = ""): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${FONT_FACE_CSS}html,body{margin:0;padding:0;background:transparent;} *{box-sizing:border-box;} ${extraCss}</style></head><body>${bodyHtml}</body></html>`;
}

export async function renderHtmlToPng(bodyHtml: string, size: { width: number; height: number }, opts: { overflowSelector?: string; extraCss?: string } = {}): Promise<RenderResult> {
  const browser = await getBrowser();
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  try {
    const fonts = await loadFontBuffers();
    await context.route("https://fonts.render.local/**", (route) => {
      const url = route.request().url();
      route.fulfill({ status: 200, contentType: "font/ttf", body: url.endsWith("bold.ttf") ? fonts.bold : fonts.regular });
    });
    const page = await context.newPage();
    await page.setContent(wrapDocument(bodyHtml, opts.extraCss), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    let overflow = false;
    let overflowSelectors: string[] = [];
    if (opts.overflowSelector) {
      overflowSelectors = await page.evaluate((sel) => {
        const out: string[] = [];
        document.querySelectorAll<HTMLElement>(sel).forEach((el, i) => {
          if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) out.push(`${sel}[${i}]`);
        });
        return out;
      }, opts.overflowSelector);
      overflow = overflowSelectors.length > 0;
    }
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, ...size } });
    return { png: Buffer.from(png), overflow, overflowSelectors };
  } finally {
    await context.close();
  }
}

export async function closeRenderBrowser() {
  const b = await g.renderBrowser?.catch(() => null);
  await b?.close();
  g.renderBrowser = undefined;
}
