import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import { networkInterfaces } from "node:os";

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

// Hosts allowed to load /_next/* dev resources (#149).
//
// Next serves those only to localhost by default, and answers 403 to anything else. A phone
// reaches the dev server by LAN address or Bonjour name, so the HTML renders and every client
// chunk 403s: React never hydrates, forms fall back to native submission, and no fetch is ever
// made -- which looks exactly like a broken login against a healthy backend.
//
// Computed rather than hard-coded so a DHCP lease change does not silently reintroduce that.
// Dev-only by definition: Next ignores this outside `next dev`.
function devOrigins(): string[] {
  if (process.env.NODE_ENV === "production") return [];
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i!.address);
  let bonjour: string[] = [];
  try {
    // macOS publishes this name over mDNS; `os.hostname()` is the router-assigned one.
    const name = execFileSync("scutil", ["--get", "LocalHostName"], { stdio: "pipe" })
      .toString()
      .trim();
    if (name) bonjour = [`${name}.local`, `${name.toLowerCase()}.local`];
  } catch {
    // Not macOS, or scutil unavailable -- the addresses above still cover it.
  }
  return [...new Set([...addresses, ...bonjour])];
}

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  poweredByHeader: false,
  allowedDevOrigins: devOrigins(),
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
