import { defineRouting } from "next-intl/routing";

// English is the fallback locale, not the common case (#179) -- a German browser
// still lands on German via Accept-Language. `en` only wins when nothing else
// (profile setting, URL, cookie, Accept-Language) resolves a locale.
export const routing = defineRouting({
  locales: ["de", "en"],
  defaultLocale: "en",
  localePrefix: "always",
});
