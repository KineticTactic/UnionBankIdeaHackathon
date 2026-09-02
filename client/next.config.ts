import type { NextConfig } from "next";

const backendUrl = process.env.API_BACKEND_URL || "http://localhost:8000";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    proxyTimeout: 60000,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${backendUrl}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
