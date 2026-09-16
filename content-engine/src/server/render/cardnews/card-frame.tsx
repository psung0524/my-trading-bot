import type { Card, CardTemplate } from "@/lib/schemas/content";
import { MagazineCard } from "./magazine-card";

export type CardColors = { primary: string; secondary: string; accent: string };

/**
 * 카드뉴스 한 장의 레이아웃. 서버 렌더(Playwright)와 브라우저 미리보기에서 동일하게 사용한다.
 * 인라인 스타일만 사용해 스크린샷 HTML에서도 Tailwind 없이 렌더링된다.
 */
export function CardFrame({ card, index, total, template, colors, brandName, size, fontFamily = "Pretendard, 'Noto Sans KR', -apple-system, sans-serif" }: {
  card: Card;
  index: number;
  total: number;
  template: CardTemplate;
  colors: CardColors;
  brandName: string;
  size: { width: number; height: number };
  fontFamily?: string;
}) {
  if (template === "magazine") return <MagazineCard card={card} index={index} total={total} colors={colors} brandName={brandName} size={size} fontFamily={fontFamily} />;
  const isCover = card.type === "cover";
  const isCta = card.type === "cta";
  const bg = isCover || isCta ? colors.primary : colors.secondary;
  const fg = isCover || isCta ? "#ffffff" : "#0f172a";
  const pad = Math.round(size.width * 0.08);
  const base: React.CSSProperties = {
    width: size.width,
    height: size.height,
    boxSizing: "border-box",
    padding: pad,
    background: bg,
    color: fg,
    fontFamily,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
    wordBreak: "keep-all",
    lineHeight: 1.25,
  };
  const titleSize = isCover ? 96 : 64;
  return (
    <div style={base} data-card-index={index}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, opacity: 0.85 }}>
        <span>{brandName}</span>
        <span>{index + 1} / {total}</span>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28 }} data-card-body>
        {card.title && <div style={{ fontSize: titleSize, fontWeight: 700, whiteSpace: "pre-wrap" }} data-card-title>{card.title}</div>}
        {card.subtitle && <div style={{ fontSize: 44, opacity: 0.9, whiteSpace: "pre-wrap" }}>{card.subtitle}</div>}
        {card.type === "calculation" && (
          <div style={{ marginTop: 12, padding: 40, borderRadius: 24, background: isCover ? "rgba(255,255,255,0.15)" : "#ffffff", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            {card.label && <div style={{ fontSize: 36, color: colors.primary, fontWeight: 600 }}>{card.label}</div>}
            <div style={{ fontSize: 88, fontWeight: 800, color: colors.primary, marginTop: 8, letterSpacing: -1 }}>{card.value}</div>
            {card.body && <div style={{ fontSize: 34, marginTop: 16, opacity: 0.75 }}>{card.body}</div>}
          </div>
        )}
        {(card.type === "comparison" || card.type === "schedule") && card.rows.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 40, background: "#ffffff", borderRadius: 20, overflow: "hidden" }}>
            <tbody>
              {card.rows.map((r, i) => (
                <tr key={i} style={{ borderTop: i ? "2px solid #e2e8f0" : undefined }}>
                  <td style={{ padding: "26px 30px", color: "#334155" }}>{r.label}</td>
                  <td style={{ padding: "26px 30px", textAlign: "right", fontWeight: 700, color: colors.primary }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(card.type === "checklist" || card.type === "step") && card.items.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 22 }}>
            {card.items.map((it, i) => (
              <li key={i} style={{ display: "flex", gap: 22, fontSize: 42, alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, width: 56, height: 56, borderRadius: 999, background: colors.accent, color: "#0f172a", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 32, fontWeight: 700 }}>{template === "steps" || card.type === "step" ? i + 1 : "✓"}</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        )}
        {card.type === "text" && card.body && <div style={{ fontSize: 44, whiteSpace: "pre-wrap", opacity: 0.92 }}>{card.body}</div>}
        {card.type === "cta" && card.body && <div style={{ fontSize: 44, opacity: 0.9 }}>{card.body}</div>}
        {card.type === "cta" && <div style={{ marginTop: 20, alignSelf: "flex-start", padding: "26px 44px", borderRadius: 999, background: colors.accent, color: "#0f172a", fontSize: 40, fontWeight: 700 }}>{card.title || "자세히 보기"} →</div>}
      </div>
      <div style={{ fontSize: 28, opacity: 0.7 }}>{isCover ? "" : card.type === "cta" ? "" : "참고용 정보 · 조건에 따라 달라질 수 있음"}</div>
      <div style={{ position: "absolute", right: -80, bottom: -80, width: 260, height: 260, borderRadius: 999, background: colors.accent, opacity: isCover ? 0.35 : 0.12 }} />
    </div>
  );
}
