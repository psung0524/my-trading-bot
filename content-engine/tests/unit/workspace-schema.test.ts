import { describe, expect, it } from "vitest";
import { createWorkspaceSchema, slugify } from "@/lib/schemas/workspace";

describe("workspace schema", () => {
  it("slugify", () => {
    expect(slugify("Dividend Team")).toBe("dividend-team");
    expect(slugify("  My--Cool  Workspace ")).toBe("my-cool-workspace");
    expect(slugify("배당팀")).toMatch(/^ws-[a-z0-9]{6}$/);
  });
  it("검증", () => {
    expect(createWorkspaceSchema.safeParse({ name: "x", slug: "ab" }).success).toBe(false);
    expect(createWorkspaceSchema.safeParse({ name: "x", slug: "Bad Slug" }).success).toBe(false);
    expect(createWorkspaceSchema.safeParse({ name: "x", slug: "good-slug-1" }).success).toBe(true);
  });
});
