import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Image uploads from System 3 (already shrunk in the browser to well under this).
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
