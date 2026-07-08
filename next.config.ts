import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // The home directory above this project has its own package-lock.json;
    // pin the workspace root so Next doesn't infer it.
    root: __dirname,
  },
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // Note: this only affects Next's own dev/proxy body handling, not
    // Vercel's platform-level Serverless Function payload cap (~4.5MB) —
    // that's why PDFs upload client-side straight to Blob (see
    // lib/clientUpload.ts) instead of riding through a server action.
    proxyClientMaxBodySize: "10mb",
  },
};

export default nextConfig;
