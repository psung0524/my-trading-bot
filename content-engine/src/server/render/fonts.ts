import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * 렌더링용 한글 폰트(Noto Sans KR). 컨테이너에 한글 시스템 폰트가 없어도 카드뉴스/영상이 깨지지 않도록
 * assets/fonts/ 에 없으면 Google Fonts에서 한 번 내려받는다. RENDER_FONT_DIR로 경로를 바꿀 수 있다.
 */
const FONT_URLS: Record<string, string> = {
  "NotoSansKR-Regular.ttf": "https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLQ.ttf",
  "NotoSansKR-Bold.ttf": "https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzg01eLQ.ttf",
};

export function fontDir() {
  return process.env.RENDER_FONT_DIR || path.join(process.cwd(), "assets", "fonts");
}

export async function ensureFonts(opts: { force?: boolean } = {}): Promise<Record<string, string>> {
  const dir = fontDir();
  await mkdir(dir, { recursive: true });
  const out: Record<string, string> = {};
  for (const [name, url] of Object.entries(FONT_URLS)) {
    const p = path.join(dir, name);
    const exists = await stat(p).then((s) => s.size > 100_000).catch(() => false);
    if (!exists || opts.force) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`폰트 다운로드 실패 ${name}: HTTP ${res.status}`);
      await writeFile(p, Buffer.from(await res.arrayBuffer()));
    }
    out[name] = p;
  }
  return out;
}

let cache: { regular: Buffer; bold: Buffer } | null = null;
export async function loadFontBuffers() {
  if (cache) return cache;
  const files = await ensureFonts();
  cache = { regular: await readFile(files["NotoSansKR-Regular.ttf"]), bold: await readFile(files["NotoSansKR-Bold.ttf"]) };
  return cache;
}

export const FONT_FACE_CSS = `
@font-face { font-family: 'RenderKR'; src: url('https://fonts.render.local/regular.ttf') format('truetype'); font-weight: 400; }
@font-face { font-family: 'RenderKR'; src: url('https://fonts.render.local/bold.ttf') format('truetype'); font-weight: 700; }
`;
export const RENDER_FONT_FAMILY = "'RenderKR', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif";
