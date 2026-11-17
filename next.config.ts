import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The local database (PGlite) is a WASM package that must load from node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
