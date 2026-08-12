import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/products",
        destination: "/produkte",
        permanent: false,
      },
      {
        source: "/products/:path*",
        destination: "/produkte/:path*",
        permanent: false,
      },
      {
        source: "/projects",
        destination: "/projekte",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
