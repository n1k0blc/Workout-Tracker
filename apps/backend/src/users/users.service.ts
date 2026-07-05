import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto, UserDto, CreateHomeGymDto, UpdateHomeGymDto, HomeGymDto } from './dto';

const ACTIVE_HOME_GYMS_SELECT = {
  homeGyms: {
    where: { deletedAt: null },
    select: { id: true, name: true, createdAt: true },
    orderBy: { name: 'asc' as const },
  },
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        height: true,
        weight: true,
        createdAt: true,
        ...ACTIVE_HOME_GYMS_SELECT,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto): Promise<UserDto> {
    const data: any = { ...updateUserDto };

    if (updateUserDto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
        select: { id: true },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email is already in use');
      }
    }

    if (updateUserDto.dateOfBirth) {
      data.dateOfBirth = new Date(updateUserDto.dateOfBirth);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        height: true,
        weight: true,
        createdAt: true,
        ...ACTIVE_HOME_GYMS_SELECT,
      },
    });

    return updatedUser;
  }

  // Home Gym CRUD methods
  async getHomeGyms(userId: string): Promise<HomeGymDto[]> {
    return this.prisma.homeGym.findMany({
      where: { userId, deletedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, createdAt: true },
    });
  }

  async createHomeGym(userId: string, createHomeGymDto: CreateHomeGymDto): Promise<HomeGymDto> {
    return this.prisma.homeGym.create({
      data: { userId, name: createHomeGymDto.name },
      select: { id: true, name: true, createdAt: true },
    });
  }

  async updateHomeGym(
    userId: string,
    gymId: string,
    updateHomeGymDto: UpdateHomeGymDto,
  ): Promise<HomeGymDto> {
    const gym = await this.prisma.homeGym.findUnique({ where: { id: gymId } });

    if (!gym || gym.deletedAt || gym.userId !== userId) {
      throw new NotFoundException('Home gym not found');
    }

    return this.prisma.homeGym.update({
      where: { id: gymId },
      data: { name: updateHomeGymDto.name },
      select: { id: true, name: true, createdAt: true },
    });
  }

  /**
   * Soft-delete (§3.8): hidden from new selection, preserved for history -- past workouts
   * referencing this gym keep resolving. Blocked only if the gym is still the planned gym
   * of an active cycle's day (the one case where deleting it would silently break planning).
   */
  async deleteHomeGym(userId: string, gymId: string): Promise<void> {
    const gym = await this.prisma.homeGym.findUnique({ where: { id: gymId } });

    if (!gym || gym.deletedAt || gym.userId !== userId) {
      throw new NotFoundException('Home gym not found');
    }

    const plannedInActiveCycle = await this.prisma.workoutDay.findFirst({
      where: { plannedHomeGymId: gymId, cycle: { status: 'ACTIVE' } },
    });

    if (plannedInActiveCycle) {
      throw new ConflictException(
        'Cannot delete a home gym that is planned for an active cycle day. Update those cycle days first.',
      );
    }

    await this.prisma.homeGym.update({
      where: { id: gymId },
      data: { deletedAt: new Date() },
    });
  }
}
