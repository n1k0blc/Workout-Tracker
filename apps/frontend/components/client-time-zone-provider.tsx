'use client';

import { useSyncExternalStore } from 'react';
import { NextIntlClientProvider, useLocale, useMessages, useTimeZone } from 'next-intl';
import { clientTimeZone } from '@/lib/local-date';

const subscribeNever = () => () => {};

/**
 * Makes next-intl format dates in the browser's zone instead of the server's.
 *
 * The server config sets no `timeZone`, so next-intl uses the server's own -- UTC in the
 * container -- and hands it to the client provider. A `YYYY-MM-DD` day built with
 * `fromLocalDateString` is local midnight, which in UTC is still the day before for anyone
 * east of Greenwich: "Sa. 31.10." on Sunday the 1st. The zone isn't known until the browser
 * runs, so hydration keeps the server's (matching the server-rendered HTML) and the client
 * switches over right after.
 */
export function ClientTimeZoneProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const messages = useMessages();
  const serverTimeZone = useTimeZone();
  // The zone never changes while the page is open, so there is nothing to subscribe to.
  const timeZone = useSyncExternalStore(subscribeNever, clientTimeZone, () => serverTimeZone);

  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
