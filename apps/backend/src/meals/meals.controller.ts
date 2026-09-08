import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MealsService } from './meals.service';
import { CreateMealDto, UpdateMealDto, MealDto, MealListDto } from './dto';

@Controller('meals')
@UseGuards(JwtAuthGuard)
export class MealsController {
  constructor(private readonly meals: MealsService) {}

  // `mine=1` narrows to the caller's own meals (the tab's "Nur meine" filter).
  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @Query('mine') mine?: string,
  ): Promise<MealListDto> {
    return this.meals.findAll(user.id, mine === '1' || mine === 'true');
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<MealDto> {
    return this.meals.findById(id, user.id);
  }

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateMealDto,
  ): Promise<MealDto> {
    return this.meals.create(user.id, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateMealDto,
  ): Promise<MealDto> {
    return this.meals.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<void> {
    return this.meals.softDelete(user.id, id);
  }
}
