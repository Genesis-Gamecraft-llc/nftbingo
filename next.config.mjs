/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/discord",
        destination: "https://mee6.xyz/i/waioENg8Ot",
        permanent: false, // 302 redirect (correct for invite links)
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push({
        "@napi-rs/canvas": "commonjs @napi-rs/canvas",
      });
    }
    return config;
  },
};

export default nextConfig;
