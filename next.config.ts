import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @resvg/resvg-wasm ships a .wasm binary. Keep it a true server-external
  // package so Turbopack doesn't bundle/mangle it — the mangled module name
  // fails to resolve at runtime and breaks /api/card/render.
  serverExternalPackages: ["@resvg/resvg-wasm"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
