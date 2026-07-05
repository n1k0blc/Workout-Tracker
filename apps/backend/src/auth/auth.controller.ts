import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ChangePasswordDto, AuthResponseDto } from './dto';
import { UserDto } from '../users/dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { generateOpaqueToken } from '../common/utils/token.util';
import { IssuedRefreshToken } from './refresh-token.service';

// Brute-force protection: 5 attempts per minute per client, well below the global default.
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';
const CSRF_TOKEN_COOKIE = 'csrf_token';
const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Refresh token only ever needs to be sent to the endpoints that consume it.
const REFRESH_TOKEN_PATH = '/api/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(AUTH_THROTTLE)
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, accessToken, refreshToken } = await this.authService.register(registerDto);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { user, accessToken, refreshToken } = await this.authService.login(loginDto);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { user };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    const currentRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!currentRefreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    const { accessToken, refreshToken } = await this.authService.refresh(currentRefreshToken);
    this.setAuthCookies(res, accessToken, refreshToken);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const currentRefreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (currentRefreshToken) {
      await this.authService.logout(currentRefreshToken);
    }
    this.clearAuthCookies(res);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: UserDto,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.changePassword(user.id, dto);
    // Every session (including this one) was just revoked - drop the cookies too.
    this.clearAuthCookies(res);
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: IssuedRefreshToken): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const base: CookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    };

    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
      ...base,
      path: '/',
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken.rawToken, {
      ...base,
      path: REFRESH_TOKEN_PATH,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });

    // Not httpOnly by design: the frontend reads this to echo it back as the
    // X-CSRF-Token header (double-submit cookie pattern).
    res.cookie(CSRF_TOKEN_COOKIE, generateOpaqueToken(), {
      ...base,
      httpOnly: false,
      path: '/',
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });
  }

  private clearAuthCookies(res: Response): void {
    const isProduction = process.env.NODE_ENV === 'production';
    const base: CookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
    };

    res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: '/' });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { ...base, path: REFRESH_TOKEN_PATH });
    res.clearCookie(CSRF_TOKEN_COOKIE, { ...base, httpOnly: false, path: '/' });
  }
}
