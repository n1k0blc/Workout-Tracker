import { NextRequest, NextResponse } from "next/server";

// Content-Security-Policy, phase 2: enforcing.
//
// Phase 1 shipped as `Content-Security-Policy-Report-Only` on 2026-09-06. A
// six-day production observation window (real logins, dashboard loads, and
// active workout sessions, container never recreated) logged zero genuine
// violations -- only the synthetic test entries from initial verification.
// See issue #125.
//
// A per-request nonce plus `strict-dynamic` covers Next's framework scripts;
// Next reads the CSP request header set below and stamps the nonce onto the
// scripts it injects. `style-src` keeps `'unsafe-inline'` because Next, recharts,
// vaul, dnd-kit and react-day-picker all set inline `style=` attributes, which a
// nonce cannot cover.
// Same origin as the app in production (every deployment config sets NEXT_PUBLIC_API_URL
// explicitly to its own domain -- see docker-compose.prod.yml / Dockerfile /
// .env.production.example). A bare `next dev` with no env file at all falls back to the
// same cross-origin backend address `apiClient` itself defaults to
// (apps/frontend/lib/api/client.ts) -- the two must agree, or the CSP below allows a
// different origin than the app actually calls, and login and every API request are
// silently blocked. Read fresh (not frozen at module load) so tests can exercise both.
function getApiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api").replace(/\/$/, "");
}

// Covers the cross-origin case (local dev, the backend on its own port); a same-origin
// API_BASE adds nothing here since 'self' already covers it.
function getApiOrigin(): string | null {
  const apiBase = getApiBase();
  return /^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : null;
}

export function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // The barcode scanner's zxing fallback compiles WebAssembly on browsers without a native
    // BarcodeDetector -- Safari, so every iPhone (#149). Far narrower than 'unsafe-eval': it
    // permits WebAssembly compilation and nothing else.
    "'wasm-unsafe-eval'",
    // React Refresh / HMR needs eval in `next dev`; never in a production build.
    isProd ? null : "'unsafe-eval'",
  ].filter(Boolean);
  const connectSrc = ["'self'", getApiOrigin()].filter(Boolean);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "img-src 'self' data: blob:",
    "object-src 'none'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${connectSrc.join(" ")}`,
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    `report-uri ${getApiBase()}/security/csp-report`,
    "report-to csp-endpoint",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the *request* `Content-Security-Policy` header to stamp the nonce
  // onto the scripts it injects.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  const reportPath = `${getApiBase()}/security/csp-report`;
  response.headers.set(
    "Reporting-Endpoints",
    `csp-endpoint="${new URL(reportPath, request.nextUrl.origin).toString()}"`,
  );
  return response;
}

export const config = {
  // HTML documents only — skip build assets and static files (a cached nonce is a wrong nonce).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)",
  ],
};
