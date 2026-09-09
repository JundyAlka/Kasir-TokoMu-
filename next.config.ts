import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  compress: true,
  experimental: {
    authInterrupts: true,
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "recharts", "date-fns"],
  },
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        // Apply CORS headers to all API routes
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          {
            key: "Access-Control-Allow-Origin",
            // Allow Flutter web dev server (8090) and any localhost
            value: "http://localhost:8090",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Cookie",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
