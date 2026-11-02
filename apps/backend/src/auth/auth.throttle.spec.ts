import { ExecutionContext, INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/**
 * Brute-force limits (#225, parent #221), observed over HTTP with the app's real global guard and
 * default limit (100/min): the Nth request in a minute passes, the one after it answers 429.
 */
describe('auth rate limits', () => {
  let app: INestApplication;
  const authService = {
    login: jest.fn(),
    changePassword: jest.fn().mockResolvedValue(undefined),
    refresh: jest.fn().mockResolvedValue({
      accessToken: 'access',
      refreshToken: { rawToken: 'refresh', expiresAt: new Date() },
    }),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }])],
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = { id: 'user-1' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  async function statuses(send: () => request.Test, count: number) {
    const out: number[] = [];
    for (let i = 0; i < count; i++) out.push((await send()).status);
    return out;
  }

  it('lets change-password through 5 times a minute, then answers 429', async () => {
    const send = () =>
      request(app.getHttpServer())
        .post('/api/auth/change-password')
        .send({ currentPassword: 'correct horse', newPassword: 'battery staple' });
    expect(await statuses(send, 6)).toEqual([204, 204, 204, 204, 204, 429]);
  });

  it('lets refresh through 30 times a minute, then answers 429', async () => {
    const send = () =>
      request(app.getHttpServer()).post('/api/auth/refresh').set('Cookie', 'refresh_token=raw');
    const all = await statuses(send, 31);
    expect(all.slice(0, 30)).toEqual(Array(30).fill(200));
    expect(all[30]).toBe(429);
  });
});
