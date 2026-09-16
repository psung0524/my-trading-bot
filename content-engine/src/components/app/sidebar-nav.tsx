"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Inbox, CalendarDays, Clock, Lightbulb, FileText, Clapperboard, BarChart3, Sparkles,
  Package, Palette, Plug, Settings, ScrollText, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS } from "./nav-items";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Inbox, CalendarDays, Clock, Lightbulb, FileText, Clapperboard, BarChart3, Sparkles,
  Package, Palette, Plug, Settings, ScrollText,
};

export function SidebarNav({ slug, onNavigate }: { slug: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const base = `/w/${slug}`;
  return (
    <nav className="flex flex-col gap-4 text-sm" aria-label="워크스페이스 메뉴">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">{section.title}</p>
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const href = `${base}${item.href}`;
              const active = item.href === "" ? pathname === base : pathname.startsWith(href);
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              return (
                <li key={item.href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent",
                      active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
