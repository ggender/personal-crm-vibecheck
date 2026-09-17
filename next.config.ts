import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home folder must not change the project root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
