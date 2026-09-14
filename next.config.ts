import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  experimental: {
    serverActions: { bodySizeLimit: "4gb" },
  },
};

export default nextConfig;
