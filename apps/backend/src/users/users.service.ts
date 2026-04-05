import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto, UserDto, CreateHomeGymDto, UpdateHomeGymDto, HomeGymDto } from './dto';

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

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(userId: string, updateUserDto: UpdateUserDto): Promise<UserDto> {
    const data: any = { ...updateUserDto };
    
    // Convert dateOfBirth string to Date if provided
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

    return updatedUser;
  }

  // Home Gym CRUD methods
  async getHomeGyms(userId: string): Promise<HomeGymDto[]> {
    const homeGyms = await this.prisma.homeGym.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return homeGyms;
  }

  async createHomeGym(userId: string, createHomeGymDto: CreateHomeGymDto): Promise<HomeGymDto> {
    const homeGym = await this.prisma.homeGym.create({
      data: {
        userId,
        name: createHomeGymDto.name,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return homeGym;
  }

  async updateHomeGym(
    userId: string,
    gymId: string,
    updateHomeGymDto: UpdateHomeGymDto,
  ): Promise<HomeGymDto> {
    // Verify ownership
    const gym = await this.prisma.homeGym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException('Home gym not found');
    }

    if (gym.userId !== userId) {
      throw new ForbiddenException('You do not have permission to update this gym');
    }

    const updatedGym = await this.prisma.homeGym.update({
      where: { id: gymId },
      data: { name: updateHomeGymDto.name },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return updatedGym;
  }

  async deleteHomeGym(userId: string, gymId: string): Promise<void> {
    // Verify ownership
    const gym = await this.prisma.homeGym.findUnique({
      where: { id: gymId },
    });

    if (!gym) {
      throw new NotFoundException('Home gym not found');
    }

    if (gym.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this gym');
    }

    // Check if any workouts are using this gym
    const workoutsCount = await this.prisma.workout.count({
      where: { homeGymId: gymId },
    });

    if (workoutsCount > 0) {
      throw new ForbiddenException(
        'Cannot delete home gym that is used in workouts. Please update those workouts first.',
      );
    }

    await this.prisma.homeGym.delete({
      where: { id: gymId },
    });
  }
}
