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
        destination: "https://zealy.io/cw/nftbingo/questboard/f9623b3f-00b5-4c91-bdac-8bae13db7add",
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
