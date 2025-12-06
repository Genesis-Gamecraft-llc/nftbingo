/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Turbopack on Vercel and locally
  turbopack: false,

  webpack: (config) => {
    // Required so @napi-rs/canvas works with Webpack
    config.externals.push({
      "@napi-rs/canvas": "commonjs @napi-rs/canvas",
    });
    return config;
  },
};

export default nextConfig;
