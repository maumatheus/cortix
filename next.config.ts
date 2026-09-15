import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  // no app desktop o servidor roda dentro de Program Files (somente leitura): o otimizador
  // de imagens tentava gravar em .next/cache e estourava EPERM. As imagens sao locais e pequenas.
  images: { unoptimized: true },
  experimental: {
    serverActions: { bodySizeLimit: "4gb" },
  },
};

export default nextConfig;
