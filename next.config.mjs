/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/discord",
        destination: "https://discord.gg/kWexunPTV3",
        permanent: false, // 302 redirect (correct for invite links)
      },
      {
        source: "/giveaway",
        destination: "https://zealy.io/cw/nftbingo/questboard/af1584ca-528a-43be-b3d1-6bc4cc5b07a2",
        permanent: false,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "gateway.irys.xyz" },
      { protocol: "https", hostname: "node1.irys.xyz" },
    ],
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
