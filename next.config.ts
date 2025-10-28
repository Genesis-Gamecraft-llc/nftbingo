import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbo: {
      enabled: false,
    },
  },
  reactStrictMode: true,
};

export default nextConfig;
