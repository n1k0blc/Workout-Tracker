import { Controller, Get, Patch, Post, Put, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto, UserDto, CreateHomeGymDto, UpdateHomeGymDto, HomeGymDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(@CurrentUser() user: { id: string }): Promise<UserDto> {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  async updateCurrentUser(
    @CurrentUser() user: { id: string },
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserDto> {
    return this.usersService.updateUser(user.id, updateUserDto);
  }

  // Home Gym endpoints
  @Get('me/home-gyms')
  async getHomeGyms(@CurrentUser() user: { id: string }): Promise<HomeGymDto[]> {
    return this.usersService.getHomeGyms(user.id);
  }

  @Post('me/home-gyms')
  async createHomeGym(
    @CurrentUser() user: { id: string },
    @Body() createHomeGymDto: CreateHomeGymDto,
  ): Promise<HomeGymDto> {
    return this.usersService.createHomeGym(user.id, createHomeGymDto);
  }

  @Patch('me/home-gyms/:gymId')
  async updateHomeGym(
    @CurrentUser() user: { id: string },
    @Param('gymId') gymId: string,
    @Body() updateHomeGymDto: UpdateHomeGymDto,
  ): Promise<HomeGymDto> {
    return this.usersService.updateHomeGym(user.id, gymId, updateHomeGymDto);
  }

  @Delete('me/home-gyms/:gymId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteHomeGym(
    @CurrentUser() user: { id: string },
    @Param('gymId') gymId: string,
  ): Promise<void> {
    return this.usersService.deleteHomeGym(user.id, gymId);
  }
}
