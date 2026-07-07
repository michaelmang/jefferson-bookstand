import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // The home directory above this project has its own package-lock.json;
    // pin the workspace root so Next doesn't infer it.
    root: __dirname,
  },
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // Posted stands upload up to five PDFs plus a background and a music track.
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
