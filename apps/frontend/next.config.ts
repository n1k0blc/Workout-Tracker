import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Enable standalone output for optimized Docker production builds.
  // This allows us to create a minimal production image without re-running npm ci.
  output: 'standalone',
};

export default nextConfig;
