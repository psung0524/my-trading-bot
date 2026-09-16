import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const font = Noto_Sans_KR({
  variable: "--font-app",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: { default: "Content Engine", template: "%s | Content Engine" },
  description: "제품 데이터를 검증된 브랜드 콘텐츠로 바꾸는 AI 콘텐츠 운영 SaaS",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${font.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
