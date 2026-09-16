import type { Card } from "@/lib/schemas/content";
import type { CardColors } from "./card-frame";

/**
 * 잡지형(magazine) 카드. 레퍼런스: 흰 배경, 형광 하이라이트 제목, 우상단 로고, "┌ 라벨" 섹션, 테두리 패널,
 * 하단 연한 그라데이션 위에 굵은 소제목 + 본문. 표지는 어두운 배경에 큰 흰 제목 + 태그 필.
 */
export function MagazineCard({ card, index, total, colors, brandName, size, fontFamily }: { card: Card; index: number; total: number; colors: CardColors; brandName: string; size: { width: number; height: number }; fontFamily: string }) {
  const W = size.width;
  const pad = Math.round(W * 0.065);
  const highlight = colors.secondary;
  const ink = "#111827";
  const muted = "#4B5563";
  const base: React.CSSProperties = { width: W, height: size.height, boxSizing: "border-box", fontFamily, position: "relative", overflow: "hidden", wordBreak: "keep-all", lineHeight: 1.3, color: ink, background: "#ffffff" };

  if (card.type === "cover") {
    return (
      <div style={{ ...base, background: `radial-gradient(circle at 20% 15%, rgba(255,255,255,0.10), transparent 40%), radial-gradient(circle at 85% 30%, rgba(255,255,255,0.08), transparent 45%), linear-gradient(180deg, #0b1020 0%, #111827 55%, #0b1020 100%)`, color: "#fff", padding: pad, display: "flex", flexDirection: "column", justifyContent: "flex-end" }} data-card-index={index}>
        <div style={{ position: "absolute", top: pad, left: pad, fontSize: 34, fontWeight: 700, opacity: 0.95 }}>@{brandName}</div>
        <div style={{ position: "absolute", top: pad - 6, right: pad, fontSize: 30, opacity: 0.7 }}>{index + 1}/{total}</div>
        <div style={{ position: "absolute", left: W * 0.35, top: size.height * 0.16, width: W * 0.75, height: W * 0.75, borderRadius: 999, background: colors.primary, opacity: 0.35, filter: "blur(40px)" }} />
        <div data-card-body style={{ position: "relative", display: "flex", flexDirection: "column", gap: 26, paddingBottom: pad * 0.4 }}>
          {card.tag && <div style={{ alignSelf: "flex-start", background: highlight, color: ink, fontSize: 32, fontWeight: 700, padding: "12px 22px", borderRadius: 12 }}>{card.tag} 📌</div>}
          <div data-card-title style={{ fontSize: 92, fontWeight: 900, lineHeight: 1.15, whiteSpace: "pre-wrap", letterSpacing: -2, textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>{card.title}</div>
          {card.subtitle && <div style={{ fontSize: 34, fontWeight: 700, color: highlight }}>└ {card.subtitle}</div>}
        </div>
      </div>
    );
  }

  const Title = () => (
    <div data-card-title style={{ fontSize: 60, fontWeight: 900, lineHeight: 1.35, letterSpacing: -1.5, maxWidth: W * 0.72 }}>
      {card.title.split("\n").map((line, i) => (
        <span key={i} style={{ display: "inline", background: `linear-gradient(transparent 52%, ${highlight} 52%)`, padding: "0 4px" }}>
          {line}
          {i < card.title.split("\n").length - 1 && <br />}
        </span>
      ))}
    </div>
  );
  const Logo = () => <div style={{ position: "absolute", top: pad - 8, right: pad, fontSize: 40, fontWeight: 900, color: colors.primary, letterSpacing: -1 }}>{brandName}</div>;
  const SectionLabel = ({ text }: { text: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 32, fontWeight: 700, color: ink, marginTop: 44, marginBottom: 18 }}>
      <span style={{ display: "inline-block", width: 22, height: 22, borderTop: `3px solid ${ink}`, borderLeft: `3px solid ${ink}` }} />
      {text}
    </div>
  );
  const panel: React.CSSProperties = { border: `2px solid #D1D5DB`, borderRadius: 22, background: "#fff", padding: "34px 40px", fontSize: 36, color: ink };
  const bottom: React.CSSProperties = { position: "absolute", left: 0, right: 0, bottom: 0, padding: `${pad * 0.8}px ${pad}px ${pad}px`, background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${highlight} 100%)` };

  let panelBody: React.ReactNode = null;
  if (card.type === "calculation") {
    panelBody = (
      <div style={panel}>
        {card.label && <div style={{ fontSize: 32, color: muted, fontWeight: 700 }}>{card.label}</div>}
        <div style={{ fontSize: 92, fontWeight: 900, color: colors.primary, letterSpacing: -2, marginTop: 6 }}>{card.value}</div>
        {card.footnote && <div style={{ fontSize: 28, color: muted, marginTop: 10 }}>{card.footnote}</div>}
      </div>
    );
  } else if ((card.type === "comparison" || card.type === "schedule") && card.rows.length) {
    panelBody = (
      <div style={panel}>
        {card.rows.map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "16px 0", borderTop: i ? "1px solid #E5E7EB" : undefined, gap: 20 }}>
            <span style={{ fontWeight: 800 }}>{r.label}</span>
            <span style={{ color: colors.primary, fontWeight: 800, textAlign: "right" }}>{r.value}</span>
          </div>
        ))}
      </div>
    );
  } else if ((card.type === "checklist" || card.type === "step") && card.items.length) {
    panelBody = (
      <div style={panel}>
        {card.items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 18, padding: "14px 0", alignItems: "flex-start" }}>
            <span style={{ fontWeight: 900, color: colors.primary, flexShrink: 0 }}>{card.type === "step" ? `${i + 1}.` : "✔"}</span>
            <span>{it}</span>
          </div>
        ))}
      </div>
    );
  } else if (card.type === "cta") {
    panelBody = (
      <div style={{ ...panel, textAlign: "center", padding: "60px 40px" }}>
        <div style={{ fontSize: 40, fontWeight: 800 }}>{card.body || "직접 계산해 보세요"}</div>
        <div style={{ display: "inline-block", marginTop: 30, background: ink, color: "#fff", padding: "22px 44px", borderRadius: 999, fontSize: 36, fontWeight: 800 }}>{card.label || card.title} →</div>
      </div>
    );
  } else if (card.type === "text" && !card.heading && card.body) {
    panelBody = <div style={{ ...panel, fontSize: 38, lineHeight: 1.6 }}>{card.body}</div>;
  }

  const showBottom = Boolean(card.heading || (card.type !== "text" && card.body) || (card.type === "text" && card.heading));
  return (
    <div style={{ ...base, padding: pad }} data-card-index={index}>
      <Logo />
      <div data-card-body style={{ paddingTop: 10 }}>
        <Title />
        {card.sectionLabel && <SectionLabel text={card.sectionLabel} />}
        {!card.sectionLabel && panelBody && <div style={{ height: 40 }} />}
        {panelBody}
        {card.footnote && card.type !== "calculation" && <div style={{ fontSize: 24, color: muted, marginTop: 14 }}>*{card.footnote}</div>}
      </div>
      {showBottom && (
        <div style={bottom}>
          {card.heading && <div style={{ fontSize: 46, fontWeight: 900, marginBottom: 22, letterSpacing: -1 }}>{card.heading}</div>}
          {card.body && card.type !== "cta" && <div style={{ fontSize: 34, lineHeight: 1.65, color: "#1F2937", whiteSpace: "pre-wrap" }}>{card.body}</div>}
        </div>
      )}
      <div style={{ position: "absolute", bottom: 26, left: 0, right: 0, textAlign: "center", fontSize: 22, color: "#9CA3AF" }}>{index + 1} / {total}</div>
    </div>
  );
}
