import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@glimpse/ui", "@glimpse/db"],
  poweredByHeader: false,
  images: { unoptimized: true },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      // Behind a hosting proxy the forwarded host must match the browser's Origin.
      allowedOrigins: [process.env.APP_URL, process.env.RENDER_EXTERNAL_URL]
        .filter((u): u is string => !!u)
        .map((u) => new URL(u).host),
    },
  },
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
    ];
    return [
      { source: "/:path*", headers: security },
      // The selfie page needs the camera, nothing else does.
      {
        source: "/e/:slug/find",
        headers: [{ key: "Permissions-Policy", value: "camera=(self), microphone=()" }],
      },
    ];
  },
};

export default config;
