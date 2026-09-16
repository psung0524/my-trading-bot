"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "./sidebar-nav";

export function AppShell({
  slug,
  workspaceName,
  userName,
  role,
  logout,
  children,
}: {
  slug: string;
  workspaceName: string;
  userName: string;
  role: string;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen flex-1">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar p-3 md:flex">
        <Link href={`/w/${slug}`} className="mb-4 px-2 py-1 font-bold">
          {workspaceName}
        </Link>
        <SidebarNav slug={slug} />
        <div className="mt-auto border-t pt-3 text-xs text-muted-foreground">
          <p className="px-2">{userName}</p>
          <p className="px-2">{role}</p>
          <div className="mt-2 flex gap-1 px-2">
            <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-xs">
              <Link href="/onboarding?new=1">워크스페이스 전환</Link>
            </Button>
            <form action={logout}>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" type="submit">
                로그아웃
              </Button>
            </form>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center gap-2 border-b px-3 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="메뉴 열기">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-3">
              <SheetTitle className="mb-3 px-2">{workspaceName}</SheetTitle>
              <SidebarNav slug={slug} onNavigate={() => setOpen(false)} />
              <form action={logout} className="mt-4 px-2">
                <Button size="sm" variant="outline" type="submit" className="w-full">
                  로그아웃
                </Button>
              </form>
            </SheetContent>
          </Sheet>
          <span className="font-semibold">{workspaceName}</span>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
