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
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientToday } from '../common/decorators/client-today.decorator';
import { Today } from '../common/utils/today.util';
import { isLocalDate } from '../common/utils/local-date.util';
import { DiaryEntriesService } from './diary-entries.service';
import { MealSlotsService } from './meal-slots.service';
import {
  CreateDiaryEntryDto,
  UpdateDiaryEntryDto,
  DiaryEntryDto,
  NutritionDayDto,
  CreateMealSlotDto,
  UpdateMealSlotDto,
  ReorderMealSlotsDto,
  MealSlotDto,
  MealSlotListDto,
} from './dto';

@Controller('nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionController {
  constructor(
    private readonly diaryEntries: DiaryEntriesService,
    private readonly mealSlots: MealSlotsService,
  ) {}

  /**
   * The Tagesansicht for one day. `date` is optional -- absent, it resolves to the client's
   * "today" from the `X-Timezone` header, exactly like the workout recommendation.
   */
  @Get('day')
  async getDay(
    @CurrentUser() user: { id: string },
    @ClientToday() today: Today,
    @Query('date') date?: string,
  ): Promise<NutritionDayDto> {
    const localDate = date ?? today.localDate;
    if (!isLocalDate(localDate)) {
      throw new BadRequestException('date must be a calendar date in YYYY-MM-DD form');
    }
    return this.diaryEntries.getDay(user.id, localDate);
  }

  // --- Abschnitte (#142) --------------------------------------------------------------------

  @Get('slots')
  async listSlots(@CurrentUser() user: { id: string }): Promise<MealSlotListDto> {
    return this.mealSlots.list(user.id);
  }

  @Post('slots')
  async createSlot(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateMealSlotDto,
  ): Promise<MealSlotDto> {
    return this.mealSlots.create(user.id, dto.name);
  }

  // Declared before `slots/:id` so the literal segment is not captured as an id.
  @Patch('slots/order')
  async reorderSlots(
    @CurrentUser() user: { id: string },
    @Body() dto: ReorderMealSlotsDto,
  ): Promise<MealSlotListDto> {
    return this.mealSlots.reorder(user.id, dto.slots);
  }

  @Patch('slots/:id')
  async updateSlot(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateMealSlotDto,
  ): Promise<MealSlotDto> {
    let slot: MealSlotDto | undefined;
    if (dto.name !== undefined) {
      slot = await this.mealSlots.rename(user.id, id, dto.name);
    }
    if (dto.archived !== undefined) {
      slot = await this.mealSlots.setArchived(user.id, id, dto.archived);
    }
    if (!slot) {
      throw new BadRequestException('name oder archived muss angegeben werden');
    }
    return slot;
  }

  // --- Einträge ---------------------------------------------------------------------------

  @Post('entries')
  async createEntry(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateDiaryEntryDto,
  ): Promise<DiaryEntryDto> {
    return this.diaryEntries.createEntry(user.id, dto);
  }

  @Patch('entries/:id')
  async updateEntry(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateDiaryEntryDto,
  ): Promise<DiaryEntryDto> {
    return this.diaryEntries.updateEntryQuantity(user.id, id, dto.quantity);
  }

  @Delete('entries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEntry(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ): Promise<void> {
    return this.diaryEntries.deleteEntry(user.id, id);
  }
}
