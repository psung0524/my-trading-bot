import { renderStatic as renderToStaticMarkup } from "../static-html";
import JSZip from "jszip";
import type { InstagramBody } from "@/lib/schemas/content";
import { renderHtmlToPng } from "../image-renderer";
import { RENDER_FONT_FAMILY } from "../fonts";
import { CardFrame } from "./card-frame";

export type CardRender = { index: number; png: Buffer; overflow: boolean };

/** 카드 한 장 렌더 */
export async function renderCard(body: InstagramBody, index: number, brandName: string): Promise<CardRender> {
  const card = body.cards[index];
  const colors = body.colors ?? { primary: "#0F766E", secondary: "#F0FDFA", accent: "#F59E0B" };
  const html = renderToStaticMarkup(<CardFrame card={card} index={index} total={body.cards.length} template={body.template} colors={colors} brandName={brandName} size={body.size} fontFamily={RENDER_FONT_FAMILY} />);
  const res = await renderHtmlToPng(html, body.size, { overflowSelector: "[data-card-body]" });
  return { index, png: res.png, overflow: res.overflow };
}

export async function renderAllCards(body: InstagramBody, brandName: string, onProgress?: (i: number) => void): Promise<CardRender[]> {
  const out: CardRender[] = [];
  for (let i = 0; i < body.cards.length; i++) {
    out.push(await renderCard(body, i, brandName));
    onProgress?.(i + 1);
  }
  return out;
}

export async function zipCards(cards: CardRender[], captionText: string): Promise<Buffer> {
  const zip = new JSZip();
  for (const c of cards) zip.file(`card-${String(c.index + 1).padStart(2, "0")}.png`, c.png);
  zip.file("caption.txt", captionText);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export { CARD_LIMITS, cardTextWarnings } from "@/lib/card-limits";
