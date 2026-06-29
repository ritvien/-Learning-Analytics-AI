import path from "path";
import type { NextConfig } from "next";

const ngrokDevOrigin = process.env.NGROK_DEV_ORIGIN?.trim();
const legacyNgrokOrigins = [
  "spectrum-dullness-ambiguous.ngrok-free.dev",
  "spectrum-dullness-ambiguous.ngrok-free.app",
];

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  allowedDevOrigins: [
    ...(ngrokDevOrigin ? [ngrokDevOrigin] : []),
    ...legacyNgrokOrigins,
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
