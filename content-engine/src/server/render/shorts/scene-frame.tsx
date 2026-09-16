import type { ShortsScene } from "@/lib/schemas/content";
import { RENDER_FONT_FAMILY } from "../fonts";

export const SHORTS_SIZE = { width: 1080, height: 1920 };
/** YouTube Shorts UI에 가려지지 않는 안전 영역: 상단 220px, 하단 420px, 좌우 80px */
export const SAFE = { top: 220, bottom: 420, side: 80 };

export function SceneFrame({ scene, index, total, colors, brandName, subtitle }: { scene: ShortsScene; index: number; total: number; colors: { primary: string; secondary: string; accent: string }; brandName: string; subtitle: string }) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const bg = isFirst || isLast ? colors.primary : colors.secondary;
  const fg = isFirst || isLast ? "#ffffff" : "#0f172a";
  return (
    <div style={{ width: SHORTS_SIZE.width, height: SHORTS_SIZE.height, background: bg, color: fg, fontFamily: RENDER_FONT_FAMILY, position: "relative", overflow: "hidden", wordBreak: "keep-all" }}>
      <div style={{ position: "absolute", top: SAFE.top, left: SAFE.side, right: SAFE.side, fontSize: 34, opacity: 0.8, display: "flex", justifyContent: "space-between" }}>
        <span>{brandName}</span>
        <span>{index + 1}/{total}</span>
      </div>
      <div data-scene-body style={{ position: "absolute", top: SAFE.top + 120, left: SAFE.side, right: SAFE.side, bottom: SAFE.bottom + 260, display: "flex", flexDirection: "column", justifyContent: "center", gap: 40 }}>
        <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1.2, whiteSpace: "pre-wrap" }}>{scene.onScreenText}</div>
        {scene.description && !isFirst && <div style={{ fontSize: 36, opacity: 0.7 }}>{scene.description}</div>}
      </div>
      {subtitle && (
        <div style={{ position: "absolute", left: SAFE.side, right: SAFE.side, bottom: SAFE.bottom, display: "flex", justifyContent: "center" }}>
          <div style={{ background: "rgba(0,0,0,0.72)", color: "#fff", fontSize: 44, lineHeight: 1.35, padding: "18px 30px", borderRadius: 18, textAlign: "center", maxWidth: "100%" }}>{subtitle}</div>
        </div>
      )}
      <div style={{ position: "absolute", right: -160, bottom: SAFE.bottom - 200, width: 420, height: 420, borderRadius: 999, background: colors.accent, opacity: isFirst || isLast ? 0.35 : 0.12 }} />
    </div>
  );
}
