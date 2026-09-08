import type { NextConfig } from "next";

// Security response headers that carry no risk of breaking the running app.
// Content-Security-Policy is deliberately excluded here — it needs a per-request
// nonce, so it lives in middleware.ts (report-only for now). See issue #125.
//
// Strict-Transport-Security is deliberately excluded too: HSTS is owned by the
// Cloudflare edge (the single source of truth — TLS terminates there and the
// origin is only reachable through the tunnel). See issue #124.
//
// Kept inline: the production Docker image copies only next.config.ts into the
// runtime stage, and Next executes this file on `next start`, so it cannot
// import from ./lib.
// Dev-only reverse proxy for the API (#149).
//
// In production the browser sees a single origin: Cloudflare routes /api to the backend and
// this rewrite is never consulted. In dev the frontend and backend are two origins, which
// works over plain HTTP only by accident -- cookies ignore the port, and main.ts's CORS
// allowlist happens to permit `http://localhost`. Neither holds the moment dev runs over
// HTTPS, which the barcode scanner needs: `getUserMedia` requires a secure context, and an
// `https://` page cannot call an `http://` API (mixed content) from an origin CORS rejects.
//
// Proxying /api through the frontend's own origin removes all of that: no CORS preflight, no
// mixed content, and first-party cookies with the same SameSite semantics production has.
// Guarded to development so it can never double-proxy in front of Cloudflare.
const BACKEND_ORIGIN = process.env.DEV_API_PROXY_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  poweredByHeader: false,
  async rewrites() {
    if (process.env.NODE_ENV === "production") return [];
    return [{ source: "/api/:path*", destination: `${BACKEND_ORIGIN}/api/:path*` }];
  },
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
