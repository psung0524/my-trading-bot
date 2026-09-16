import { describe, expect, it } from "vitest";
import { renderStatic } from "@/server/render/static-html";
import { CardFrame } from "@/server/render/cardnews/card-frame";

describe("renderStatic", () => {
  it("인라인 스타일과 이스케이프", () => {
    const html = renderStatic(<div style={{ fontSize: 12, opacity: 0.5, background: "#fff" }} data-x="1">{"<b>"}</div>);
    expect(html).toBe('<div style="font-size:12px;opacity:0.5;background:#fff" data-x="1">&lt;b&gt;</div>');
  });
  it("CardFrame 렌더", () => {
    const html = renderStatic(<CardFrame card={{ id: "c1", type: "calculation", title: "필요 투자금", subtitle: "", body: "", label: "연간", value: "600만 원", items: [], rows: [], factRefs: [], tag: "", sectionLabel: "", heading: "", footnote: "" }} index={0} total={5} template="number-focus" colors={{ primary: "#0F766E", secondary: "#F0FDFA", accent: "#F59E0B" }} brandName="브랜드" size={{ width: 1080, height: 1350 }} />);
    expect(html).toContain("600만 원");
    expect(html).toContain("data-card-body");
    expect(html).toContain("width:1080px");
  });
});
