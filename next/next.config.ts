import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["3000-irl8p9vfib30hvlxlt9sd-25e71f7f.us3.manus.computer"],
  // Firebase Admin uses Node-only dependencies that must remain external in Vercel server functions.
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
