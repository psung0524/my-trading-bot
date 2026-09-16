import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ProductAnalysis } from "@/lib/schemas/product";
import type { ProductAnalyzer } from "./types";

const MAX_BYTES = 1_000_000;
const TIMEOUT_MS = 8000;

/** SSRF 방지: 사설/루프백/링크로컬 대역 차단 */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:127.") || v6.startsWith("::ffff:10.") || v6.startsWith("::ffff:192.168.");
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("http/https URL만 허용됩니다");
  const host = url.hostname;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("내부 주소는 분석할 수 없습니다");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (ips.length === 0 || ips.some(isPrivateAddress)) throw new Error("내부 네트워크 주소는 분석할 수 없습니다");
  return url;
}

function decode(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function meta(html: string, name: string): string {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i");
  return decode(html.match(re)?.[1] ?? html.match(re2)?.[1] ?? "");
}

/** 공개 페이지의 메타/헤딩/링크를 파싱한다. JS 렌더링은 하지 않는다. */
export class HtmlProductAnalyzer implements ProductAnalyzer {
  async analyze(raw: string): Promise<ProductAnalysis> {
    const url = await assertPublicUrl(raw);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: "follow",
        headers: { "user-agent": "ContentEngineBot/0.1 (+product-analysis)", accept: "text/html" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/html")) throw new Error("HTML 페이지가 아닙니다");
      const buf = Buffer.from(await res.arrayBuffer());
      const html = buf.subarray(0, MAX_BYTES).toString("utf8").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");

      const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || meta(html, "og:title");
      const description = meta(html, "description") || meta(html, "og:description");
      const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
        .map((m) => decode(m[1].replace(/<[^>]+>/g, "")))
        .filter((h) => h.length > 1 && h.length < 80)
        .slice(0, 20);
      const keywords = meta(html, "keywords").split(",").map((k) => k.trim()).filter(Boolean).slice(0, 20);
      const pages = [...html.matchAll(/<a[^>]+href=["']([^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
        .map((m) => ({ href: m[1], text: decode(m[2].replace(/<[^>]+>/g, "")) }))
        .filter((l) => l.href.startsWith("/") && l.href.length > 1 && l.text)
        .reduce<{ path: string; title: string }[]>((acc, l) => {
          if (!acc.some((p) => p.path === l.href) && acc.length < 15) acc.push({ path: l.href, title: l.text.slice(0, 60) });
          return acc;
        }, []);

      return {
        title,
        description,
        headings,
        features: headings.slice(0, 8),
        keywords,
        audience: "",
        pages,
        method: "html",
        fetchedAt: new Date().toISOString(),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
