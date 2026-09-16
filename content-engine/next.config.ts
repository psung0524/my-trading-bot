import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["playwright-core", "ffmpeg-static", "bcryptjs", "@prisma/client", "msedge-tts"],
  images: { dangerouslyAllowLocalIP: true },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // 고객 사이트에 삽입되는 SDK와 수집 API는 교차 출처 허용
      { source: "/ce-sdk.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600" }, { key: "Access-Control-Allow-Origin", value: "*" }] },
    ];
  },
};

export default nextConfig;
