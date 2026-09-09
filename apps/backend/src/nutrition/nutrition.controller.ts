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
import { PickerService, toPickerScope } from './picker.service';
import {
  CreateDiaryEntryDto,
  CreateDiaryEntriesBatchDto,
  CreateDiaryEntriesFromMealDto,
  CopyDiaryDayDto,
  CopyDiarySlotDto,
  CopySourceDatesDto,
  UpdateDiaryEntryDto,
  DiaryEntryDto,
  NutritionDayDto,
  CreateMealSlotDto,
  UpdateMealSlotDto,
  ReorderMealSlotsDto,
  MealSlotDto,
  MealSlotListDto,
  PickerListDto,
} from './dto';

@Controller('nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionController {
  constructor(
    private readonly diaryEntries: DiaryEntriesService,
    private readonly mealSlots: MealSlotsService,
    private readonly picker: PickerService,
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

  // --- Picker: Favoriten & Zuletzt (#148) --------------------------------------------------

  // `scope=food` narrows to Lebensmittel only -- the Zutat search inside the Mahlzeit editor,
  // where a meal cannot be an ingredient. Anything else means foods and meals (the logging
  // picker).
  @Get('picker/favorites')
  async pickerFavorites(
    @CurrentUser() user: { id: string },
    @Query('scope') scope?: string,
  ): Promise<PickerListDto> {
    return this.picker.getFavorites(user.id, toPickerScope(scope));
  }

  @Get('picker/recent')
  async pickerRecent(
    @CurrentUser() user: { id: string },
    @Query('scope') scope?: string,
  ): Promise<PickerListDto> {
    return this.picker.getRecent(user.id, toPickerScope(scope));
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

  // The picker's basket: several food entries in one request (#144).
  @Post('entries/batch')
  async createEntriesBatch(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateDiaryEntriesBatchDto,
  ): Promise<{ count: number }> {
    return this.diaryEntries.createFromFoodBatch(user.id, dto);
  }

  // Logs a Mahlzeit: expands it into one entry per ingredient, scaled by the Faktor (#147).
  @Post('entries/meal')
  async createEntriesFromMeal(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateDiaryEntriesFromMealDto,
  ): Promise<{ count: number }> {
    return this.diaryEntries.createFromMeal(user.id, dto);
  }

  // --- Von einem anderen Tag kopieren (#151) --------------------------------------------

  // The days the user has entries on -- the copy date picker offers only these. `exclude`
  // drops the day the picker was opened on.
  @Get('copy/source-dates')
  async copySourceDates(
    @CurrentUser() user: { id: string },
    @Query('exclude') exclude?: string,
  ): Promise<CopySourceDatesDto> {
    const cleanExclude = exclude && isLocalDate(exclude) ? exclude : undefined;
    return { dates: await this.diaryEntries.listCopySourceDates(user.id, cleanExclude) };
  }

  // Copies one Abschnitt's entries from another day into the same Abschnitt on the target day.
  @Post('entries/copy-slot')
  async copySlot(
    @CurrentUser() user: { id: string },
    @Body() dto: CopyDiarySlotDto,
  ): Promise<{ count: number }> {
    return this.diaryEntries.copySlot(user.id, dto);
  }

  // Copies a whole day's entries onto the target day, each staying in its own Abschnitt
  // (archived ones fall back to a visible "Sonstiges").
  @Post('entries/copy-day')
  async copyDay(
    @CurrentUser() user: { id: string },
    @Body() dto: CopyDiaryDayDto,
  ): Promise<{ count: number }> {
    return this.diaryEntries.copyDay(user.id, dto);
  }

  @Patch('entries/:id')
  async updateEntry(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateDiaryEntryDto,
  ): Promise<DiaryEntryDto> {
    return this.diaryEntries.updateEntryQuantity(
      user.id,
      id,
      dto.quantity,
      dto.quantityLabel,
    );
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
