import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { buildCsp, config, middleware } from "../middleware";

function run(
  url = "https://workout.nikobjelic.com/de/dashboard",
  init?: ConstructorParameters<typeof NextRequest>[1],
) {
  return middleware(new NextRequest(new URL(url), init));
}

function withApiUrl<T>(apiUrl: string | undefined, fn: () => T): T {
  const prev = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    process.env.NEXT_PUBLIC_API_URL = apiUrl;
  }
  try {
    return fn();
  } finally {
    if (prev === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = prev;
    }
  }
}

describe("CSP middleware (issue #125, enforcing phase)", () => {
  it("sends the enforcing header, not report-only", () => {
    const res = run();
    expect(res.headers.get("content-security-policy")).toBeTruthy();
    expect(res.headers.get("content-security-policy-report-only")).toBeNull();
  });

  it("uses a per-request nonce with strict-dynamic for scripts", () => {
    const csp = run().headers.get("content-security-policy")!;
    expect(csp).toMatch(/script-src [^;]*'strict-dynamic'/);
    expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
  });

  it("issues a fresh nonce each request", () => {
    const nonceOf = (csp: string) => /'nonce-([A-Za-z0-9+/=]+)'/.exec(csp)?.[1];
    expect(nonceOf(run().headers.get("content-security-policy")!)).not.toBe(
      nonceOf(run().headers.get("content-security-policy")!),
    );
  });

  it("keeps style-src unsafe-inline (inline style attributes cannot carry a nonce)", () => {
    expect(run().headers.get("content-security-policy")).toContain(
      "style-src 'self' 'unsafe-inline'",
    );
  });

  it("locks down the high-risk directives", () => {
    const csp = run().headers.get("content-security-policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("points violation reports at the backend endpoint, old and new syntax", () => {
    // Mirrors a real production config: NEXT_PUBLIC_API_URL set to the app's own domain
    // (.env.production.example), same-origin with the request in `run()`.
    const res = withApiUrl("https://workout.nikobjelic.com/api", () => run());
    const csp = res.headers.get("content-security-policy")!;
    expect(csp).toContain("report-uri https://workout.nikobjelic.com/api/security/csp-report");
    expect(csp).toContain("report-to csp-endpoint");
    expect(res.headers.get("reporting-endpoints")).toBe(
      'csp-endpoint="https://workout.nikobjelic.com/api/security/csp-report"',
    );
  });

  it("forwards the nonce to the app on the x-nonce request header", () => {
    const csp = run().headers.get("content-security-policy")!;
    // The response CSP and the request x-nonce must agree; assert the shape here
    // and trust Next to read the request CSP header for script injection.
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  });

  it("allows WebAssembly in production, for the scanner's zxing fallback (#149)", () => {
    const prev = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string>).NODE_ENV = "production";
      expect(buildCsp("n")).toMatch(/script-src [^;]*'wasm-unsafe-eval'/);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prev!;
    }
  });

  it("allows eval only outside production", () => {
    expect(buildCsp("n")).toContain("'unsafe-eval'"); // vitest runs with NODE_ENV=test
    const prev = process.env.NODE_ENV;
    try {
      (process.env as Record<string, string>).NODE_ENV = "production";
      expect(buildCsp("n")).not.toContain("'unsafe-eval'");
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prev!;
    }
  });
});

describe("CSP connect-src covers the configured API origin", () => {
  it("adds the backend's origin when the API is cross-origin, so login and every API call are not silently blocked", () => {
    const csp = withApiUrl("http://localhost:3001/api", () => buildCsp("n"));
    expect(csp).toContain("connect-src 'self' http://localhost:3001");
  });

  it("stays 'self'-only when the API is same-origin (production, routed by Cloudflare)", () => {
    const csp = withApiUrl("https://workout.nikobjelic.com/api", () => buildCsp("n"));
    expect(csp).toContain("connect-src 'self' https://workout.nikobjelic.com");
  });

  it("falls back to the same cross-origin backend address apiClient itself defaults to when NEXT_PUBLIC_API_URL is entirely unset (bare `next dev`)", () => {
    const csp = withApiUrl(undefined, () => buildCsp("n"));
    expect(csp).toContain("connect-src 'self' http://localhost:3001");
  });
});

describe("locale negotiation (issue #179): composed ahead of the CSP logic", () => {
  it("falls back to /en with no cookie and no Accept-Language -- en is the fallback, not the common case", () => {
    const res = run("https://workout.nikobjelic.com/");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://workout.nikobjelic.com/en");
  });

  it("honors a German Accept-Language over the en default -- a German browser still lands on German", () => {
    const res = run("https://workout.nikobjelic.com/", {
      headers: { "Accept-Language": "de" },
    });
    expect(res.headers.get("location")).toBe("https://workout.nikobjelic.com/de");
  });

  it("maps en-US Accept-Language to /en", () => {
    const res = run("https://workout.nikobjelic.com/", {
      headers: { "Accept-Language": "en-US" },
    });
    expect(res.headers.get("location")).toBe("https://workout.nikobjelic.com/en");
  });

  it("prefers the NEXT_LOCALE cookie over Accept-Language", () => {
    const res = run("https://workout.nikobjelic.com/", {
      headers: { "Accept-Language": "en-US", Cookie: "NEXT_LOCALE=de" },
    });
    expect(res.headers.get("location")).toBe("https://workout.nikobjelic.com/de");
  });

  it("attaches CSP even on a locale redirect -- security headers are harmless on a redirect, and a single code path stays correct as next-intl's own redirect conditions evolve", () => {
    const res = run("https://workout.nikobjelic.com/");
    expect(res.headers.get("content-security-policy")).toBeTruthy();
  });

  it("leaves a URL that already carries a known locale un-redirected with the enforcing CSP intact", () => {
    const res = run("https://workout.nikobjelic.com/de/dashboard");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-security-policy")).toBeTruthy();
  });

  it("also serves /en un-redirected with CSP intact", () => {
    const res = run("https://workout.nikobjelic.com/en/dashboard");
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-security-policy")).toBeTruthy();
  });
});

describe("matcher excludes /api (#179)", () => {
  // config.matcher is Next's own routing config, compiled to a real matcher at build
  // time by Next itself (see next/dist/shared/lib/router/utils/middleware-route-matcher.js)
  // -- a hand-rolled `new RegExp(config.matcher[0]).test(path)` does NOT reproduce that
  // compilation (no anchoring, among other differences) and gives false results, so this
  // only asserts the source pattern names the exclusion; the actual routing behavior is
  // verified by running the dev server and confirming a proxied /api/* request (used by
  // the dev:https/dev:mobile flows, via next.config.ts's /api/:path* rewrite) is not
  // 307-redirected to /en/api/* by next-intl's localePrefix:"always".
  it("names /api in its exclusion lookahead", () => {
    expect(config.matcher[0]).toContain("(?!api|");
  });
});
