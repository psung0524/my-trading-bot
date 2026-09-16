import { z } from "zod";

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "슬러그는 3자 이상")
  .max(40, "슬러그는 40자 이하")
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "영문 소문자, 숫자, 하이픈만 사용할 수 있습니다");

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "워크스페이스 이름을 입력하세요").max(60),
  slug: slugSchema,
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const RESERVED_SLUGS = new Set([
  "api", "login", "signup", "onboarding", "w", "admin", "settings", "new", "static", "public",
]);

/** 이름에서 슬러그 후보를 만든다. 한글 등 비ASCII는 제거되며, 비면 랜덤 접미사를 쓴다. */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base.length >= 3 ? base : `ws-${Math.random().toString(36).slice(2, 8)}`;
}
