import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com",
  "font-src 'self' data:",
  "frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://accounts.google.com https://api.cloudinary.com wss://*.firebaseio.com",
].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["3000-irl8p9vfib30hvlxlt9sd-25e71f7f.us3.manus.computer"],
  // Firebase Admin uses Node-only dependencies that must remain external in Vercel server functions.
  serverExternalPackages: ["firebase-admin"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" }],
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: contentSecurityPolicy },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
        // Google signInWithPopup يحتاج السماح بإغلاق/تواصل نافذة OAuth مع الصفحة الأصلية.
        { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
        { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
      ],
    }];
  },
};

export default nextConfig;
