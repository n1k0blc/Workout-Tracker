import type { NextConfig } from "next";

// Security response headers that carry no risk of breaking the running app.
// Content-Security-Policy is deliberately excluded — it can white-screen
// production and gets its own ticket with a report-only rollout.
//
// Strict-Transport-Security is deliberately excluded too: HSTS is owned by the
// Cloudflare edge (the single source of truth — TLS terminates there and the
// origin is only reachable through the tunnel). See issue #124.
//
// Kept inline: the production Docker image copies only next.config.ts into the
// runtime stage, and Next executes this file on `next start`, so it cannot
// import from ./lib.
const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
