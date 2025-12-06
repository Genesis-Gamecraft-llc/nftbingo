/** @type {import('next').NextConfig} */
const nextConfig = {
  // We are already using Webpack via: `next dev --webpack`
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent webpack from trying to bundle the native @napi-rs/canvas binary
      config.externals = config.externals || [];
      config.externals.push("@napi-rs/canvas");
    }

    return config;
  },
};

export default nextConfig;
