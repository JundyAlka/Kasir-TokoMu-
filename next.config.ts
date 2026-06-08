import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
