import { requireWorkspacePage } from "@/server/tenancy/context";
import { AppShell } from "@/components/app/app-shell";
import { logoutAction } from "@/server/actions/auth";

export default async function WorkspaceLayout(props: LayoutProps<"/w/[slug]">) {
  const { slug } = await props.params;
  const ctx = await requireWorkspacePage(slug);
  return (
    <AppShell
      slug={ctx.workspace.slug}
      workspaceName={ctx.workspace.name}
      userName={ctx.user.name || ctx.user.email}
      role={ctx.role}
      logout={logoutAction}
    >
      {props.children}
    </AppShell>
  );
}
