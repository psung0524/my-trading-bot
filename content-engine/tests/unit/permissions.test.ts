import { describe, expect, it } from "vitest";
import { can, roleAtLeast } from "@/server/tenancy/permissions";

describe("permissions", () => {
  it("역할 순서", () => {
    expect(roleAtLeast("OWNER", "ADMIN")).toBe(true);
    expect(roleAtLeast("EDITOR", "ADMIN")).toBe(false);
    expect(roleAtLeast("VIEWER", "VIEWER")).toBe(true);
  });
  it("승인/게시는 ADMIN 이상", () => {
    expect(can("EDITOR", "approveContent")).toBe(false);
    expect(can("ADMIN", "approveContent")).toBe(true);
    expect(can("ADMIN", "publishContent")).toBe(true);
    expect(can("VIEWER", "editContent")).toBe(false);
    expect(can("EDITOR", "editContent")).toBe(true);
    expect(can("ADMIN", "manageMembers")).toBe(false);
    expect(can("OWNER", "manageMembers")).toBe(true);
  });
});
