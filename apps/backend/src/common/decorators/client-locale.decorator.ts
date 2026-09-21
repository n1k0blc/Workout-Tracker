import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { ApiLocale, LOCALE_HEADER, resolveRegisterLocale } from '../utils/locale.util';

/**
 * The user's UI locale, read from the `X-Locale` header the client sends with every request.
 * Requests without one (direct API calls, server-side rendering) fall back to the default
 * locale rather than failing -- mirrors `ClientToday` / `X-Timezone`.
 */
export const ClientLocale = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiLocale => {
    const request = ctx.switchToHttp().getRequest();
    return resolveRegisterLocale(request.headers?.[LOCALE_HEADER]);
  },
);
