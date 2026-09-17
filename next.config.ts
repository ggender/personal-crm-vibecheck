import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home folder must not change the project root.
  turbopack: {
    root: __dirname,
  },
  logging: {
    // In development Next.js prints Server Function arguments to the terminal —
    // that would put names and note texts into the log. House rule: never.
    serverFunctions: false,
  },
};

export default nextConfig;
