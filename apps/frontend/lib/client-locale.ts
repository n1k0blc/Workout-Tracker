import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";

/**
 * The active `[locale]` URL segment, read straight off `window.location` -- the same
 * client-side signal `apiClient` already reads for the 401 redirect and the `X-Locale`
 * request header. Falls back to the routing default for a headerless/direct call
 * (server-side rendering, or an unrecognised/missing segment).
 */
export function clientLocale(): string {
  if (typeof window === "undefined") return routing.defaultLocale;
  const segment = window.location.pathname.split("/")[1];
  return hasLocale(routing.locales, segment) ? segment : routing.defaultLocale;
}
