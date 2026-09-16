import { Fragment, type ReactElement, type ReactNode } from "react";
import { escapeHtml } from "@/lib/markdown";

/**
 * 최소 정적 JSX → HTML 렌더러. 렌더 템플릿(CardFrame, SceneFrame, ThumbnailFrame)은 훅 없이
 * 인라인 스타일만 쓰는 순수 함수 컴포넌트이므로 react-dom/server 없이 문자열로 만든다.
 * (Next.js는 서버 컴포넌트 그래프에서 react-dom/server import를 금지한다)
 */
const VOID = new Set(["br", "hr", "img", "input", "meta", "link"]);

function styleToCss(style: Record<string, unknown>): string {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => {
      const name = k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      const unitless = /^(opacity|z-index|flex|flex-grow|flex-shrink|font-weight|line-height|order)$/.test(name);
      const val = typeof v === "number" && !unitless && v !== 0 ? `${v}px` : String(v);
      return `${name}:${val}`;
    })
    .join(";");
}

function attrName(k: string) {
  if (k === "className") return "class";
  if (k === "htmlFor") return "for";
  return k;
}

export function renderStatic(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string") return escapeHtml(node);
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(renderStatic).join("");
  const el = node as ReactElement<Record<string, unknown>>;
  if (!el || typeof el !== "object" || !("type" in el)) return "";
  const { type, props } = el;
  if (type === Fragment) return renderStatic(props.children as ReactNode);
  if (typeof type === "function") {
    const Comp = type as (p: Record<string, unknown>) => ReactNode;
    return renderStatic(Comp(props));
  }
  if (typeof type !== "string") return "";
  const attrs: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    if (k === "children" || k === "key" || k === "ref" || v === undefined || v === null || v === false) continue;
    if (k === "style" && typeof v === "object") {
      attrs.push(`style="${escapeHtml(styleToCss(v as Record<string, unknown>))}"`);
      continue;
    }
    if (k === "dangerouslySetInnerHTML") continue;
    if (typeof v === "function") continue;
    attrs.push(v === true ? attrName(k) : `${attrName(k)}="${escapeHtml(String(v))}"`);
  }
  const open = `<${type}${attrs.length ? " " + attrs.join(" ") : ""}>`;
  if (VOID.has(type)) return open;
  const inner = props.dangerouslySetInnerHTML && typeof props.dangerouslySetInnerHTML === "object" ? String((props.dangerouslySetInnerHTML as { __html: string }).__html) : renderStatic(props.children as ReactNode);
  return `${open}${inner}</${type}>`;
}
