export type NavItem = { href: string; label: string; icon: string };

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "업무",
    items: [
      { href: "", label: "오늘의 업무", icon: "LayoutDashboard" },
      { href: "/inbox", label: "승인함", icon: "Inbox" },
      { href: "/calendar", label: "콘텐츠 캘린더", icon: "CalendarDays" },
      { href: "/schedule", label: "예약 게시", icon: "Clock" },
    ],
  },
  {
    title: "콘텐츠",
    items: [
      { href: "/topics", label: "콘텐츠 소재", icon: "Lightbulb" },
      { href: "/content", label: "콘텐츠", icon: "FileText" },
      { href: "/renders", label: "렌더링", icon: "Clapperboard" },
    ],
  },
  {
    title: "성과",
    items: [
      { href: "/analytics", label: "분석", icon: "BarChart3" },
      { href: "/learning", label: "브랜드 학습", icon: "Sparkles" },
    ],
  },
  {
    title: "설정",
    items: [
      { href: "/products", label: "제품", icon: "Package" },
      { href: "/brand", label: "브랜드 프로필", icon: "Palette" },
      { href: "/channels", label: "채널 연결", icon: "Plug" },
      { href: "/settings", label: "워크스페이스", icon: "Settings" },
      { href: "/audit", label: "감사 로그", icon: "ScrollText" },
    ],
  },
];
