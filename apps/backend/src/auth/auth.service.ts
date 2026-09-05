import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from './dto';
import { UserDto } from '../users/dto';
import { PasswordService } from './password.service';
import { BreachedPasswordService } from './breached-password.service';
import { RefreshTokenService, IssuedRefreshToken } from './refresh-token.service';

const BREACHED_PASSWORD_MESSAGE =
  'This password has appeared in a known data breach. Please choose a different password.';

const USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  height: true,
  weight: true,
  createdAt: true,
  homeGyms: {
    select: { id: true, name: true, createdAt: true },
    orderBy: { name: 'asc' as const },
  },
};

export interface AuthSession {
  user: UserDto;
  accessToken: string;
  refreshToken: IssuedRefreshToken;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private passwordService: PasswordService,
    private breachedPasswordService: BreachedPasswordService,
    private refreshTokenService: RefreshTokenService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthSession> {
    const { email, password, firstName, lastName, dateOfBirth, height, weight, homeGyms } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    if (await this.breachedPasswordService.isBreached(password)) {
      throw new BadRequestException(BREACHED_PASSWORD_MESSAGE);
    }

    const passwordHash = await this.passwordService.hash(password);

    let user: UserDto;
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          dateOfBirth: new Date(dateOfBirth),
          height,
          weight,
          homeGyms: {
            create: homeGyms.map((gym) => ({
              name: gym.name,
            })),
          },
        },
        select: USER_SELECT,
      });
    } catch (error) {
      throw new InternalServerErrorException('Failed to create user');
    }

    return this.issueSession(user);
  }

  async login(loginDto: LoginDto): Promise<AuthSession> {
    const { email, password } = loginDto;

    const userWithPassword = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });

    if (!userWithPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.passwordService.verify(password, userWithPassword.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Transparent upgrade: a successful legacy-bcrypt verify gets rehashed to argon2id.
    if (this.passwordService.needsRehash(userWithPassword.passwordHash)) {
      const upgradedHash = await this.passwordService.hash(password);
      await this.prisma.user.update({
        where: { id: userWithPassword.id },
        data: { passwordHash: upgradedHash },
      });
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userWithPassword.id },
      select: USER_SELECT,
    });

    return this.issueSession(user);
  }

  async refresh(rawRefreshToken: string): Promise<{ accessToken: string; refreshToken: IssuedRefreshToken }> {
    const { userId, ...refreshToken } = await this.refreshTokenService.rotate(rawRefreshToken);
    const accessToken = await this.generateAccessToken(userId);
    return { accessToken, refreshToken };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    await this.refreshTokenService.revoke(rawRefreshToken);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    const isCurrentPasswordValid = await this.passwordService.verify(dto.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (await this.breachedPasswordService.isBreached(dto.newPassword)) {
      throw new BadRequestException(BREACHED_PASSWORD_MESSAGE);
    }

    const newHash = await this.passwordService.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Credential change: rotate every session out, including the current one.
    await this.refreshTokenService.revokeAllForUser(userId);
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async issueSession(user: UserDto): Promise<AuthSession> {
    const accessToken = await this.generateAccessToken(user.id);
    const refreshToken = await this.refreshTokenService.issue(user.id);
    return { user, accessToken, refreshToken };
  }

  private async generateAccessToken(userId: string): Promise<string> {
    const payload = { sub: userId };
    return this.jwtService.signAsync(payload);
  }
}
