import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  serverExternalPackages: ["playwright-core", "ffmpeg-static", "bcryptjs", "@prisma/client"],
  images: { dangerouslyAllowLocalIP: true },
};

export default nextConfig;
