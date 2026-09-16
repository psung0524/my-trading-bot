import type { BlogBody } from "@/lib/schemas/content";
import { renderMarkdown } from "@/lib/markdown";

export function BlogPreview({ body }: { body: BlogBody }) {
  const html = renderMarkdown(blogToMarkdown(body));
  return <article className="blog-preview max-w-none rounded-md border bg-card p-6 text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function blogToMarkdown(b: BlogBody): string {
  const parts: string[] = [`# ${b.title}`, ""];
  if (b.metaDescription) parts.push(`> ${b.metaDescription}`, "");
  if (b.asOfDate) parts.push(`기준일: ${b.asOfDate}`, "");
  if (b.toc.length) parts.push("## 목차", ...b.toc.map((t, i) => `${i + 1}. ${t}`), "");
  for (const s of b.sections) parts.push(`## ${s.heading}`, "", s.markdown, "");
  if (b.faq.length) {
    parts.push("## 자주 묻는 질문", "");
    for (const f of b.faq) parts.push(`**Q. ${f.q}**`, "", f.a, "");
  }
  if (b.sources.length) parts.push("## 출처", ...b.sources.map((s) => `- ${s.name}${s.url ? ` (${s.url})` : ""}${s.retrievedAt ? ` · ${s.retrievedAt}` : ""}`), "");
  if (b.internalLinks.length) parts.push(...b.internalLinks.map((l) => `- [${l.label}](${l.url})`), "");
  if (b.cta) parts.push(`**[${b.cta.label}](${b.cta.url})**`, "");
  if (b.disclaimer) parts.push("---", "", `_${b.disclaimer}_`, "");
  return parts.join("\n");
}
