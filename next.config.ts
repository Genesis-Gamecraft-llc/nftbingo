import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    appDir: true, // <-- this line enables the /app directory routing
  },
};

export default nextConfig;
