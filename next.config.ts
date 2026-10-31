import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone hanya untuk menjalankan server produksi di luar Vercel
  // (lokal/sandbox). Vercel memakai output default Next.js.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
