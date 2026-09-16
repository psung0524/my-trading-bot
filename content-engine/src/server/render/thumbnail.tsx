import { renderStatic as renderToStaticMarkup } from "./static-html";
import { renderHtmlToPng } from "./image-renderer";
import { RENDER_FONT_FAMILY } from "./fonts";

export type ThumbColors = { primary: string; secondary: string; accent: string };

/** 블로그 썸네일(1200x630) / Shorts 썸네일(1080x1920) 공용 */
export function ThumbnailFrame({ text, brandName, colors, size, subtitle = "" }: { text: string; brandName: string; colors: ThumbColors; size: { width: number; height: number }; subtitle?: string }) {
  const vertical = size.height > size.width;
  return (
    <div style={{ width: size.width, height: size.height, background: colors.primary, color: "#fff", fontFamily: RENDER_FONT_FAMILY, padding: Math.round(size.width * 0.08), boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden", wordBreak: "keep-all" }}>
      <div style={{ fontSize: vertical ? 40 : 30, opacity: 0.85 }}>{brandName}</div>
      <div style={{ fontSize: vertical ? 110 : 76, fontWeight: 700, lineHeight: 1.2, whiteSpace: "pre-wrap" }}>{text}</div>
      <div style={{ fontSize: vertical ? 40 : 28, opacity: 0.85 }}>{subtitle}</div>
      <div style={{ position: "absolute", right: -120, bottom: -120, width: vertical ? 520 : 360, height: vertical ? 520 : 360, borderRadius: 999, background: colors.accent, opacity: 0.35 }} />
    </div>
  );
}

export async function renderThumbnail(text: string, brandName: string, colors: ThumbColors, size: { width: number; height: number }, subtitle = "") {
  const html = renderToStaticMarkup(<ThumbnailFrame text={text} brandName={brandName} colors={colors} size={size} subtitle={subtitle} />);
  return (await renderHtmlToPng(html, size)).png;
}
