import type { WorkspaceRole } from "@prisma/client";

const ROLE_RANK: Record<WorkspaceRole, number> = {
  VIEWER: 0,
  EDITOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function roleAtLeast(role: WorkspaceRole, min: WorkspaceRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

/** 기능별 최소 역할 */
export const PERMISSIONS = {
  viewContent: "VIEWER",
  editContent: "EDITOR",
  generateContent: "EDITOR",
  approveContent: "ADMIN",
  publishContent: "ADMIN",
  manageChannels: "ADMIN",
  manageBrand: "EDITOR",
  manageMembers: "OWNER",
  manageWorkspace: "OWNER",
  deleteWorkspace: "OWNER",
  viewAudit: "ADMIN",
} as const satisfies Record<string, WorkspaceRole>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: WorkspaceRole, permission: Permission): boolean {
  return roleAtLeast(role, PERMISSIONS[permission]);
}
