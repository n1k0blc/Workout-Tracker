import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, LoginDto, AuthResponseDto } from './dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName, dateOfBirth, height, weight, homeGyms } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await this.hashPassword(password);

    // Create user with profile data and home gyms in a transaction
    try {
      const user = await this.prisma.user.create({
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
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          height: true,
          weight: true,
          createdAt: true,
          homeGyms: {
            select: {
              id: true,
              name: true,
              createdAt: true,
            },
            orderBy: {
              name: 'asc',
            },
          },
        },
      });

      // Generate JWT token
      const access_token = await this.generateToken(user.id, user.email);

      return {
        access_token,
        user,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async login(loginDto: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginDto;

    // Find user by email with password hash for verification
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

    // Verify password
    const isPasswordValid = await this.verifyPassword(password, userWithPassword.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Fetch full user data with profile and homeGyms
    const user = await this.prisma.user.findUnique({
      where: { id: userWithPassword.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        height: true,
        weight: true,
        createdAt: true,
        homeGyms: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    // Generate JWT token
    const access_token = await this.generateToken(user.id, user.email);

    return {
      access_token,
      user,
    };
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

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  private async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  private async generateToken(userId: string, email: string): Promise<string> {
    const payload = { sub: userId, email };
    return this.jwtService.signAsync(payload);
  }
}
