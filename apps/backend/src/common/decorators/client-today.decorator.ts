import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { TIME_ZONE_HEADER, Today, resolveToday } from '../utils/today.util';

/**
 * The user's current calendar day, read from the `X-Timezone` header the client sends with
 * every request. Requests without one (direct API calls, server-side rendering) fall back to
 * the pinned server zone rather than failing.
 */
export const ClientToday = createParamDecorator((_data: unknown, ctx: ExecutionContext): Today => {
  const request = ctx.switchToHttp().getRequest();
  return resolveToday(request.headers?.[TIME_ZONE_HEADER]);
});
