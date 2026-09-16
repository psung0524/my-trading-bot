/**
 * 최소 Markdown → HTML 변환기 (헤딩, 문단, 목록, 표, 굵게/기울임, 링크, 인용, 구분선).
 * 출력 전 모든 텍스트를 이스케이프하므로 XSS에 안전하다. 외부 라이브러리 의존 없음.
 */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+?)\*(?!\*)/g, "$1<em>$2</em>");
  out = out.replace(/(^|[^_])_([^_]+?)_(?!_)/g, "$1<em>$2</em>");
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]*)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');
  return out;
}

export function renderMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let i = 0;
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${para.map(inline).join("<br/>")}</p>`);
      para = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      flushPara();
      i++;
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara();
      html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      flushPara();
      html.push("<hr/>");
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushPara();
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        q.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      html.push(`<blockquote><p>${q.map(inline).join("<br/>")}</p></blockquote>`);
      continue;
    }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|\s*[-:]+/.test(lines[i + 1])) {
      flushPara();
      const cells = (l: string) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|/.test(lines[i])) {
        rows.push(cells(lines[i]));
        i++;
      }
      html.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      html.push(`<ul>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      html.push(`<ol>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</ol>`);
      continue;
    }
    para.push(line);
    i++;
  }
  flushPara();
  return html.join("\n");
}
