// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { clientLocale } from "./client-locale";

function setPathname(pathname: string) {
  window.history.pushState({}, "", pathname);
}

describe("clientLocale", () => {
  afterEach(() => {
    setPathname("/");
  });

  it("reads a supported locale off the URL's first path segment", () => {
    setPathname("/de/profile");
    expect(clientLocale()).toBe("de");

    setPathname("/en/dashboard");
    expect(clientLocale()).toBe("en");
  });

  it("falls back to the routing default for an unrecognised segment", () => {
    setPathname("/fr/profile");
    expect(clientLocale()).toBe("en");
  });

  it("falls back to the routing default for the bare root", () => {
    setPathname("/");
    expect(clientLocale()).toBe("en");
  });
});
