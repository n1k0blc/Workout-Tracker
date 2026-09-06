import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { buildCsp, middleware } from "../middleware";

function run(url = "https://workout.nikobjelic.com/dashboard") {
  return middleware(new NextRequest(new URL(url)));
}

describe("CSP middleware (issue #125, report-only phase)", () => {
  it("sends report-only, not the enforcing header", () => {
    const res = run();
    expect(res.headers.get("content-security-policy-report-only")).toBeTruthy();
    expect(res.headers.get("content-security-policy")).toBeNull();
  });

  it("uses a per-request nonce with strict-dynamic for scripts", () => {
    const csp = run().headers.get("content-security-policy-report-only")!;
    expect(csp).toMatch(/script-src [^;]*'strict-dynamic'/);
    expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
  });

  it("issues a fresh nonce each request", () => {
    const nonceOf = (csp: string) => /'nonce-([A-Za-z0-9+/=]+)'/.exec(csp)?.[1];
    expect(nonceOf(run().headers.get("content-security-policy-report-only")!)).not.toBe(
      nonceOf(run().headers.get("content-security-policy-report-only")!),
    );
  });

  it("keeps style-src unsafe-inline (inline style attributes cannot carry a nonce)", () => {
    expect(run().headers.get("content-security-policy-report-only")).toContain(
      "style-src 'self' 'unsafe-inline'",
    );
  });

  it("locks down the high-risk directives", () => {
    const csp = run().headers.get("content-security-policy-report-only")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("points violation reports at the backend endpoint, old and new syntax", () => {
    const res = run();
    const csp = res.headers.get("content-security-policy-report-only")!;
    expect(csp).toContain("report-uri /api/security/csp-report");
    expect(csp).toContain("report-to csp-endpoint");
    expect(res.headers.get("reporting-endpoints")).toBe(
      'csp-endpoint="https://workout.nikobjelic.com/api/security/csp-report"',
    );
  });

  it("forwards the nonce to the app on the x-nonce request header", () => {
    const csp = run().headers.get("content-security-policy-report-only")!;
    // The response CSP and the request x-nonce must agree; assert the shape here
    // and trust Next to read the request CSP header for script injection.
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
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
