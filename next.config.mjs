/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Turbopack (must be an object, not a boolean)
  turbopack: {},

  webpack: (config) => {
    // Required for @napi-rs/canvas to work on server bundles
    config.externals.push({
      "@napi-rs/canvas": "commonjs @napi-rs/canvas",
    });

    return config;
  },
};

export default nextConfig;
