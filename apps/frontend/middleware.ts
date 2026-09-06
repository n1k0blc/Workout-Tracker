import { NextRequest, NextResponse } from "next/server";

// Content-Security-Policy, phase 1: report-only.
//
// It ships as `Content-Security-Policy-Report-Only` so a missed source reports a
// violation instead of blanking the page. Observe production for a real usage
// window, widen for any legitimate source, then switch the header name to the
// enforcing `Content-Security-Policy`. See issue #125.
//
// A per-request nonce plus `strict-dynamic` covers Next's framework scripts;
// Next reads the CSP request header set below and stamps the nonce onto the
// scripts it injects. `style-src` keeps `'unsafe-inline'` because Next, recharts,
// vaul, dnd-kit and react-day-picker all set inline `style=` attributes, which a
// nonce cannot cover.
// Same origin as the app in production (Cloudflare routes /api to the backend);
// in local dev NEXT_PUBLIC_API_URL points straight at the backend on :3001.
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "/api").replace(/\/$/, "");
const REPORT_PATH = `${API_BASE}/security/csp-report`;

export function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // React Refresh / HMR needs eval in `next dev`; never in a production build.
    isProd ? null : "'unsafe-eval'",
  ].filter(Boolean);

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
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    `report-uri ${REPORT_PATH}`,
    "report-to csp-endpoint",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the *request* `Content-Security-Policy` header to stamp the nonce
  // onto the scripts it injects. The browser never sees this one — the response
  // below carries the report-only header instead, so nothing is enforced yet.
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy-Report-Only", csp);
  response.headers.set(
    "Reporting-Endpoints",
    `csp-endpoint="${new URL(REPORT_PATH, request.nextUrl.origin).toString()}"`,
  );
  return response;
}

export const config = {
  // HTML documents only — skip build assets and static files (a cached nonce is a wrong nonce).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)",
  ],
};
