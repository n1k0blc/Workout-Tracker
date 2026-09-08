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
import {
  CreateDiaryEntryDto,
  UpdateDiaryEntryDto,
  DiaryEntryDto,
  NutritionDayDto,
} from './dto';

@Controller('nutrition')
@UseGuards(JwtAuthGuard)
export class NutritionController {
  constructor(private readonly diaryEntries: DiaryEntriesService) {}

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
