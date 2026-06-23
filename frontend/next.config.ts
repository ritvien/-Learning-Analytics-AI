import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  allowedDevOrigins: [
    "spectrum-dullness-ambiguous.ngrok-free.dev",
    "spectrum-dullness-ambiguous.ngrok-free.app"
  ],
  async redirects() {
    return [
      {
        source: "/chatbot",
        destination: "/chat",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
