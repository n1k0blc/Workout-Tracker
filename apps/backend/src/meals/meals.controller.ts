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
import { ClientLocale } from '../common/decorators/client-locale.decorator';
import { ApiLocale } from '../common/utils/locale.util';
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
    @ClientLocale() locale: ApiLocale,
    @Query('mine') mine?: string,
  ): Promise<MealListDto> {
    return this.meals.findAll(user.id, mine === '1' || mine === 'true', locale);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @ClientLocale() locale: ApiLocale,
  ): Promise<MealDto> {
    return this.meals.findById(id, user.id, locale);
  }

  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateMealDto,
    @ClientLocale() locale: ApiLocale,
  ): Promise<MealDto> {
    return this.meals.create(user.id, dto, locale);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateMealDto,
    @ClientLocale() locale: ApiLocale,
  ): Promise<MealDto> {
    return this.meals.update(user.id, id, dto, locale);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<void> {
    return this.meals.softDelete(user.id, id);
  }
}
