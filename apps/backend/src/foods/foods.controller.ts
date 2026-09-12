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
import { FoodsService } from './foods.service';
import {
  CreateFoodDto,
  UpdateFoodDto,
  FoodDto,
  FoodListDto,
  SimilarFoodDto,
  BarcodeLookupDto,
} from './dto';

@Controller('foods')
@UseGuards(JwtAuthGuard)
export class FoodsController {
  constructor(private readonly foods: FoodsService) {}

  @Get()
  async findAll(
    @CurrentUser() user: { id: string },
    @Query('search') search?: string,
  ): Promise<FoodListDto> {
    return this.foods.findAll(user.id, search);
  }

  // Declared before `:id` so "similar" is not captured as an id.
  @Get('similar')
  async findSimilar(
    @CurrentUser() user: { id: string },
    @Query('name') name?: string,
  ): Promise<SimilarFoodDto[]> {
    return this.foods.findSimilar(user.id, name ?? '');
  }

  /**
   * The barcode scanner's miss chain (#149). Declared before `:id` so a barcode is not read as
   * an id. A GET with a side effect: a miss that Open Food Facts answers is cached, and a
   * rescanned soft-deleted row is undeleted -- both are library upkeep the scan triggers, not
   * a state change the caller asked for, so it stays a GET the client can retry freely.
   */
  @Get('barcode/:barcode')
  async lookupByBarcode(
    @CurrentUser() user: { id: string },
    @Param('barcode') barcode: string,
  ): Promise<BarcodeLookupDto> {
    return this.foods.lookupByBarcode(user.id, barcode);
  }

  @Get(':id')
  async findOne(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<FoodDto> {
    return this.foods.findById(id, user.id);
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateFoodDto): Promise<FoodDto> {
    return this.foods.create(user.id, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateFoodDto,
  ): Promise<FoodDto> {
    return this.foods.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string): Promise<void> {
    return this.foods.softDelete(user.id, id);
  }
}
